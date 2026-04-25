import { loadServiceKey } from './auth';
import type { ServiceKeyEnv } from './auth';
import type { PortalResponse } from './types/common';

export interface PortalClientOptions {
  /** 기본: https://apis.data.go.kr */
  baseUrl?: string;
  /** 기본: 10_000 (10s). 실제 타임아웃 적용은 다음 feature 에서. */
  timeoutMs?: number;
  /** 기본: 1 (429/5xx 1회 재시도). 실제 재시도 로직은 다음 feature 에서. */
  retries?: number;
}

export interface PortalRequest {
  /** 엔드포인트 경로 (예: /1480000/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty) */
  path: string;
  /** serviceKey 는 자동 주입. 그 외 query param (number 는 문자열화). */
  query?: Record<string, string | number | undefined>;
}

const DEFAULT_BASE_URL = 'https://apis.data.go.kr';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;

/**
 * data.go.kr 공공데이터포털 HTTP 클라이언트 뼈대.
 *
 * 현재는 인증키 주입 + URL 생성만 구현되어 있고, 실제 `fetch` / 재시도 / 응답 파싱은
 * 다음 feature (유사사례 검색) 에서 필요 엔드포인트부터 채운다.
 *
 * 사용 예 (구현 완료 이후):
 *   const client = new PortalClient(env);
 *   const res = await client.call<AirQualityItem>({ path, query });
 */
export class PortalClient {
  private readonly serviceKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly retries: number;

  constructor(env: ServiceKeyEnv, opts: PortalClientOptions = {}) {
    this.serviceKey = loadServiceKey(env);
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = opts.retries ?? DEFAULT_RETRIES;
  }

  /**
   * SERVICE_KEY + 추가 query 를 주입한 최종 URL 을 반환한다.
   * 반환된 URL 에는 인증키가 포함되므로 로그에 그대로 출력하지 말 것.
   */
  buildUrl(req: PortalRequest): string {
    const url = new URL(req.path, this.baseUrl);
    url.searchParams.set('serviceKey', this.serviceKey);
    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }

  /**
   * data.go.kr 엔드포인트 호출.
   * - AbortController 로 timeoutMs 적용
   * - 5xx / 429 응답은 retries 회 재시도
   * - resultCode !== '00' 이면 즉시 throw
   * - 에러 메시지에서 serviceKey 를 redact 한다
   */
  async call<T>(req: PortalRequest): Promise<PortalResponse<T>> {
    const url = this.buildUrl(req);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status >= 500 || res.status === 429) {
          lastErr = new Error(`portal http ${res.status}`);
          continue;
        }
        const json = (await res.json()) as PortalResponse<T>;
        const code = json.response?.header?.resultCode;
        if (code !== '00') {
          throw new Error(`portal resultCode=${code} msg=${json.response?.header?.resultMsg}`);
        }
        return json;
      } catch (e) {
        lastErr = e;
        // retry on transient errors only
        const m = e instanceof Error ? e.message : String(e);
        if (!/portal http (5\d\d|429)|aborted/i.test(m)) throw redact(e, this.serviceKey);
      }
    }
    throw redact(lastErr, this.serviceKey);
  }
}

function redact(err: unknown, key: string): Error {
  const m = err instanceof Error ? err.message : String(err);
  return new Error(m.split(key).join('***'));
}
