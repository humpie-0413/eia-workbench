import { PortalClient } from '../packages/eia-data/src/client';
import {
  dscssBsnsListItemSchema,
  dscssIngDetailItemSchema,
  type DscssIngDetailItem
} from '../packages/eia-data/src/types/discussion';
import {
  buildDscssListPath,
  buildDscssIngDetailPath,
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
  // P1: detail 카운터 (spec §10.4 detail 호출 정책)
  detail_called: number;
  detail_success: number;
  detail_retry: number;
  detail_failed: number;
  region_matched: number;
  region_unmatched: number;
}

const DEFAULT_MAX_API_CALLS = 8000;
const DEFAULT_NUM_OF_ROWS = 100;
const DEFAULT_MAX_PAGES = 50;
const MAX_LIST_FAIL_LOGS = 5;
const MAX_NOT_KEYWORD_LOGS = 2;

async function fetchIngDetail(
  client: PortalClient,
  eiaCd: string
): Promise<DscssIngDetailItem[] | undefined> {
  const path = buildDscssIngDetailPath();
  const res = await client.call<unknown>({
    path,
    query: { type: 'json', eiaCd, numOfRows: 100, pageNo: 1 }
  });
  const r = res as {
    response?: { header?: { resultCode?: string }; body?: { items?: unknown; totalCount?: unknown } };
  };
  if (r?.response?.header?.resultCode !== '00') {
    throw new Error(`detail header non-OK: ${r?.response?.header?.resultCode}`);
  }
  const itemsField = r?.response?.body?.items;
  // empty body: items='' (string, totalCount=0) or { item: undefined }
  if (!itemsField || typeof itemsField === 'string') return [];
  const item = (itemsField as { item?: unknown }).item;
  const arr = Array.isArray(item) ? item : item != null ? [item] : [];
  // zod safeParse — 파싱 실패한 항목 skip (전체 fail 아님)
  const parsed: DscssIngDetailItem[] = [];
  for (const it of arr) {
    const p = dscssIngDetailItemSchema.safeParse(it);
    if (p.success) parsed.push(p.data);
  }
  return parsed;
}

async function fetchIngDetailWithRetry(
  client: PortalClient,
  eiaCd: string,
  counter: { retry: number; failed: number }
): Promise<DscssIngDetailItem[] | undefined> {
  try {
    return await fetchIngDetail(client, eiaCd);
  } catch {
    counter.retry++;
    try {
      return await fetchIngDetail(client, eiaCd);
    } catch {
      counter.failed++;
      return undefined; // list-only fallback
    }
  }
}

export async function runIndexer(opts: IndexerOpts): Promise<IndexerSummary> {
  const max = opts.maxApiCalls ?? DEFAULT_MAX_API_CALLS;
  const numOfRows = opts.numOfRows ?? DEFAULT_NUM_OF_ROWS;
  const maxPages = opts.maxPagesPerQuery ?? DEFAULT_MAX_PAGES;
  const client = new PortalClient(opts.env);
  // detail 호출은 outer fetchIngDetailWithRetry 가 retry/fallback 책임 (spec §10.4
  // detail 호출 정책). PortalClient 내부 retry 까지 겹치면 detail_retry 카운터가
  // 부정확해지고 단일 호출당 5xx 시 최대 4 시도로 부풀어 api_calls 한도를 잠식.
  const detailClient = new PortalClient(opts.env, { retries: 0 });
  let api_calls = 0;
  let records_total = 0;
  let records_added = 0;
  let records_skipped = 0;
  let detail_called = 0;
  let detail_success = 0;
  let detail_retry = 0;
  let detail_failed = 0;
  let region_matched = 0;
  let region_unmatched = 0;
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
  // 3개 searchText (풍력/해상풍력/육상풍력) 중복 방지: eiaCd 기준 dedup.
  // D1 INSERT OR REPLACE 가 있어도 detail_called/api_calls 가 3 배로 부풀어 spec 임계 왜곡.
  const seenEiaCd = new Set<string>();

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
          // dedup: 동일 eiaCd 가 2번째 이후 검색어에서 다시 나오면 skip.
          if (seenEiaCd.has(listItem.eiaCd)) {
            continue;
          }
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
          // 통과 (onshore wind candidate) → seen 마킹.
          seenEiaCd.add(listItem.eiaCd);
          // P1: list 통과 → Ing detail call (retry 1) → transform (spec §10.4)
          let detailItems: DscssIngDetailItem[] | undefined;
          if (api_calls < max) {
            detail_called++;
            const counter = { retry: 0, failed: 0 };
            detailItems = await fetchIngDetailWithRetry(detailClient, listItem.eiaCd, counter);
            api_calls += 1 + counter.retry; // 본 호출 + retry
            detail_retry += counter.retry;
            if (detailItems !== undefined) detail_success++;
            else detail_failed += counter.failed;
          }

          const row = transformDscssItem({ list: listItem as never, detailItems });
          if (!row) {
            records_skipped++;
            skip_reasons.transform_null++;
            continue;
          }
          if (row.region_sido) region_matched++;
          else region_unmatched++;
          rows.push(row);
          records_added++;
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await applyStageAndSwap(opts.env.DB, rows);

  return {
    records_total,
    records_added,
    records_skipped,
    api_calls,
    error,
    skip_reasons,
    detail_called,
    detail_success,
    detail_retry,
    detail_failed,
    region_matched,
    region_unmatched
  };
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
    console.log(
      JSON.stringify({
        kind: 'cases-indexer-counters',
        detail_called: summary.detail_called,
        detail_success: summary.detail_success,
        detail_retry: summary.detail_retry,
        detail_failed: summary.detail_failed,
        region_matched: summary.region_matched,
        region_unmatched: summary.region_unmatched
      })
    );
  }
};
