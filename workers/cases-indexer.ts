import { PortalClient } from '../packages/eia-data/src/client';
import { dscssBsnsListItemSchema } from '../packages/eia-data/src/types/discussion';
import {
  buildDscssListPath,
  WIND_SEARCH_TEXTS
} from '../packages/eia-data/src/endpoints/discussion';
import { transformDscssItem, type TransformedRow } from '../src/features/similar-cases/transform';
import { classifyOnshoreWind } from '../src/features/similar-cases/wind-filter';

export interface IndexerEnv {
  SERVICE_KEY: string;
  DB: D1Database;
}

export interface IndexerOpts {
  env: IndexerEnv;
  maxApiCalls?: number;
  numOfRows?: number;
  maxPagesPerQuery?: number;
}

export interface SkipReasons {
  list_schema_invalid: number;
  wind_offshore: number;
  wind_not_keyword: number;
  transform_null: number;
}

export interface IndexerSummary {
  records_total: number;
  records_added: number;
  records_skipped: number;
  api_calls: number;
  error: string | null;
  skip_reasons: SkipReasons;
}

const DEFAULT_MAX_API_CALLS = 8000;
const DEFAULT_NUM_OF_ROWS = 100;
const DEFAULT_MAX_PAGES = 50;
const MAX_LIST_FAIL_LOGS = 5;
const MAX_NOT_KEYWORD_LOGS = 2;

export async function runIndexer(opts: IndexerOpts): Promise<IndexerSummary> {
  const max = opts.maxApiCalls ?? DEFAULT_MAX_API_CALLS;
  const numOfRows = opts.numOfRows ?? DEFAULT_NUM_OF_ROWS;
  const maxPages = opts.maxPagesPerQuery ?? DEFAULT_MAX_PAGES;
  const client = new PortalClient(opts.env);
  let api_calls = 0;
  let records_total = 0;
  let records_added = 0;
  let records_skipped = 0;
  let error: string | null = null;
  const rows: TransformedRow[] = [];
  const skip_reasons: SkipReasons = {
    list_schema_invalid: 0,
    wind_offshore: 0,
    wind_not_keyword: 0,
    transform_null: 0
  };
  let listFailLogged = 0;
  let notKeywordLogged = 0;

  try {
    const listPath = buildDscssListPath();
    queryLoop: for (const searchText of WIND_SEARCH_TEXTS) {
      for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
        if (api_calls >= max) {
          error = `api_calls limit reached (${api_calls})`;
          break queryLoop;
        }
        const res = await client.call<unknown>({
          path: listPath,
          query: { type: 'json', pageNo, numOfRows, searchText }
        });
        api_calls++;
        const items = normalizeItems<unknown>(getItem(res));
        records_total += items.length;
        if (items.length === 0) break;

        for (const raw of items) {
          const listParsed = dscssBsnsListItemSchema.safeParse(raw);
          if (!listParsed.success) {
            if (listFailLogged < MAX_LIST_FAIL_LOGS) {
              const issue = listParsed.error.issues[0];
              console.warn(
                JSON.stringify({
                  kind: 'list_schema_fail',
                  path: issue?.path,
                  message: issue?.message,
                  received_keys: raw && typeof raw === 'object' ? Object.keys(raw as object) : null
                })
              );
              listFailLogged++;
            }
            records_skipped++;
            skip_reasons.list_schema_invalid++;
            continue;
          }
          const listItem = listParsed.data;
          const cls = classifyOnshoreWind({ bizNm: listItem.bizNm });
          if (cls !== 'ok') {
            if (cls === 'not_wind_keyword' && notKeywordLogged < MAX_NOT_KEYWORD_LOGS) {
              console.warn(
                JSON.stringify({
                  kind: 'wind_not_keyword',
                  bizNm: listItem.bizNm,
                  received_keys: Object.keys(listItem)
                })
              );
              notKeywordLogged++;
            }
            records_skipped++;
            if (cls === 'offshore') skip_reasons.wind_offshore++;
            else skip_reasons.wind_not_keyword++;
            continue;
          }
          const row = transformDscssItem({ list: listItem as never });
          if (!row) {
            records_skipped++;
            skip_reasons.transform_null++;
            continue;
          }
          rows.push(row);
          records_added++;
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await applyStageAndSwap(opts.env.DB, rows);

  return { records_total, records_added, records_skipped, api_calls, error, skip_reasons };
}

function getItem(res: unknown): unknown {
  if (!res || typeof res !== 'object') return undefined;
  const r = res as { response?: { body?: { items?: { item?: unknown } } } };
  return r.response?.body?.items?.item;
}

function normalizeItems<T>(item: T | T[] | undefined): T[] {
  if (item == null) return [];
  return Array.isArray(item) ? item : [item];
}

async function applyStageAndSwap(db: D1Database, rows: TransformedRow[]): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS eia_cases_staging AS SELECT * FROM eia_cases WHERE 0`);
  await db.exec(`DELETE FROM eia_cases_staging`);
  for (const r of rows) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO eia_cases_staging (
           eia_cd, eia_seq, biz_gubun_cd, biz_gubun_nm, biz_nm,
           biz_main_nm, approv_organ_nm, biz_money, biz_size, biz_size_dan,
           drfop_tmdt, drfop_start_dt, drfop_end_dt, eia_addr_txt, industry,
           region_sido, region_sido_code, region_sigungu, capacity_mw, area_ha,
           evaluation_year, evaluation_stage, source_dataset, source_payload, fetched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        r.eia_cd,
        r.eia_seq,
        r.biz_gubun_cd,
        r.biz_gubun_nm,
        r.biz_nm,
        r.biz_main_nm,
        r.approv_organ_nm,
        r.biz_money,
        r.biz_size,
        r.biz_size_dan,
        r.drfop_tmdt,
        r.drfop_start_dt,
        r.drfop_end_dt,
        r.eia_addr_txt,
        r.industry,
        r.region_sido,
        r.region_sido_code,
        r.region_sigungu,
        r.capacity_mw,
        r.area_ha,
        r.evaluation_year,
        r.evaluation_stage,
        r.source_dataset,
        r.source_payload
      )
      .run();
  }
  await db.batch([
    db.prepare(`DROP TABLE IF EXISTS eia_cases_old`),
    db.prepare(`ALTER TABLE eia_cases RENAME TO eia_cases_old`),
    db.prepare(`ALTER TABLE eia_cases_staging RENAME TO eia_cases`),
    db.prepare(`DROP TABLE eia_cases_old`)
  ]);
}

export default {
  async scheduled(_event: ScheduledEvent, env: IndexerEnv): Promise<void> {
    const summary = await runIndexer({ env });
    console.log(JSON.stringify({ kind: 'cases-indexer', summary }));
  }
};
