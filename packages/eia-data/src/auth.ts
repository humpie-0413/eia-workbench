/**
 * 공공데이터포털 (data.go.kr) 일반 인증키 로더.
 * 환경변수: SERVICE_KEY (Cloudflare Pages Secret 으로 주입)
 *
 * 키 값은 반환값으로만 사용하고 로그·에러 메시지에 출력하지 않는다 (CLAUDE.md §6).
 */

export class MissingServiceKeyError extends Error {
  constructor() {
    super(
      'SERVICE_KEY 환경변수가 설정되지 않았습니다. `wrangler pages secret put SERVICE_KEY` 로 주입하세요.'
    );
    this.name = 'MissingServiceKeyError';
  }
}

export interface ServiceKeyEnv {
  SERVICE_KEY?: string;
}

/**
 * 환경변수에서 SERVICE_KEY 를 읽어 반환한다.
 * 값이 없거나 공백만 있으면 MissingServiceKeyError 를 던진다.
 */
export function loadServiceKey(env: ServiceKeyEnv): string {
  const key = env.SERVICE_KEY?.trim();
  if (!key) {
    throw new MissingServiceKeyError();
  }
  return key;
}
