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
   * 엔드포인트 호출. **현재는 미구현 스텁** — 다음 feature 에서 구현.
   */
  async call<T>(_req: PortalRequest): Promise<PortalResponse<T>> {
    throw new Error(
      'PortalClient.call: not implemented — 다음 feature (유사사례 검색) 에서 구현 예정'
    );
  }
}
