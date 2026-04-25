import { PortalClient } from '../packages/eia-data/src/client';
import {
  draftListItemSchema,
  draftDetailItemSchema,
  strategyDraftListItemSchema,
  strategyDraftDetailItemSchema
} from '../packages/eia-data/src/types/draft-display';
import {
  buildDraftListPath,
  buildDetailPath,
  WIND_BIZ_GUBN_CODES,
  WIND_SEARCH_TEXTS
} from '../packages/eia-data/src/endpoints/draft-display';
import { transformItem, type TransformedRow } from '../src/features/similar-cases/transform';

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

export interface IndexerSummary {
  records_total: number;
  records_added: number;
  records_skipped: number;
  api_calls: number;
  error: string | null;
}

const DEFAULT_MAX_API_CALLS = 8000;
const DEFAULT_NUM_OF_ROWS = 100;
const DEFAULT_MAX_PAGES = 5;

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

  try {
    for (const stage of ['draft', 'strategy'] as const) {
      const listPath = buildDraftListPath(stage);
      const detailPath = buildDetailPath(stage);
      const listSchema = stage === 'draft' ? draftListItemSchema : strategyDraftListItemSchema;
      const detailSchema = stage === 'draft' ? draftDetailItemSchema : strategyDraftDetailItemSchema;

      stageLoop: for (const searchText of WIND_SEARCH_TEXTS) {
        for (const bizGubn of WIND_BIZ_GUBN_CODES) {
          for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
            if (api_calls >= max) {
              error = `api_calls limit reached (${api_calls})`;
              break stageLoop;
            }
            const res = await client.call<unknown>({
              path: listPath,
              query: { type: 'json', pageNo, numOfRows, bizGubn, searchText }
            });
            api_calls++;
            const items = normalizeItems<unknown>(getItem(res));
            records_total += items.length;
            if (items.length === 0) break;

            for (const raw of items) {
              const listParsed = listSchema.safeParse(raw);
              if (!listParsed.success) {
                records_skipped++;
                continue;
              }
              const listItem = listParsed.data;
              if (api_calls >= max) {
                error = `api_calls limit reached (${api_calls})`;
                break stageLoop;
              }
              const detailRes = await client.call<unknown>({
                path: detailPath,
                query: { type: 'json', eiaCd: listItem.eiaCd }
              });
              api_calls++;
              const detailRaw = pickFirst(getItem(detailRes));
              const detailParsed = detailSchema.safeParse({ ...listItem, ...(detailRaw ?? {}) });
              if (!detailParsed.success) {
                records_skipped++;
                continue;
              }
              const row = transformItem({
                stage,
                list: listItem as never,
                detail: detailParsed.data as never
              });
              if (!row) {
                records_skipped++;
                continue;
              }
              rows.push(row);
              records_added++;
            }
          }
        }
      }
      if (error) break;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await applyStageAndSwap(opts.env.DB, rows);

  return { records_total, records_added, records_skipped, api_calls, error };
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

function pickFirst<T>(item: T | T[] | undefined | null): T | null {
  if (item == null) return null;
  return Array.isArray(item) ? (item[0] ?? null) : item;
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
        r.eia_cd, r.eia_seq, r.biz_gubun_cd, r.biz_gubun_nm, r.biz_nm,
        r.biz_main_nm, r.approv_organ_nm, r.biz_money, r.biz_size, r.biz_size_dan,
        r.drfop_tmdt, r.drfop_start_dt, r.drfop_end_dt, r.eia_addr_txt, r.industry,
        r.region_sido, r.region_sido_code, r.region_sigungu, r.capacity_mw, r.area_ha,
        r.evaluation_year, r.evaluation_stage, r.source_dataset, r.source_payload
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
