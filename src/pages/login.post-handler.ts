import { loginSchema } from '@/lib/schemas';
import { timingSafeEqual } from '@/lib/auth/password';
import { signJwt } from '@/lib/auth/jwt';
import { buildSessionCookie } from '@/lib/auth/session';
import { isBlocked, recordAttempt } from '@/lib/auth/rate-limit';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { newJti } from '@/lib/id';
import { logger } from '@/lib/logger';
import { LOGIN_MIN_RESPONSE_MS, SESSION_MAX_AGE_SECONDS } from '@/lib/constants';

export type LoginPostResult =
  | { kind: 'response'; response: Response }
  | { kind: 'error'; message: string };

async function applyFloor(started: number): Promise<void> {
  const elapsed = Date.now() - started;
  if (elapsed < LOGIN_MIN_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, LOGIN_MIN_RESPONSE_MS - elapsed));
  }
}

/**
 * POST /login handler.
 *
 * Responsibilities:
 *   - Validate input, rate-limit IP, verify Turnstile, compare password.
 *   - On success: issue session cookie (303 → `/`).
 *   - On validation/auth failure: return an error message for the form to re-render.
 *   - On internal exception (e.g. verifyTurnstile network fault): floor the response
 *     to LOGIN_MIN_RESPONSE_MS before returning a generic 500 — otherwise an attacker
 *     who can force the Turnstile verify endpoint to be unreachable would see a fast
 *     500, leaking timing signal.
 *
 * The logger receives `jti: 'login_post_error'` as a stable event tag; the logger
 * hashes `jti` to an 8-char identifier in output, so no exception detail leaks.
 */
export async function handleLoginPost(
  request: Request,
  env: Env,
  ip: string
): Promise<LoginPostResult> {
  const started = Date.now();
  try {
    if (await isBlocked(env.DB, ip)) {
      await applyFloor(started);
      return { kind: 'error', message: '잠시 후 다시 시도하세요.' };
    }
    const form = await request.formData();
    const parsed = loginSchema.safeParse({
      password: form.get('password'),
      turnstileToken: form.get('cf-turnstile-response')
    });
    if (!parsed.success) {
      await recordAttempt(env.DB, ip, false);
      await applyFloor(started);
      return { kind: 'error', message: '입력값을 다시 확인해 주세요.' };
    }
    const turnstileOk = await verifyTurnstile(
      parsed.data.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      ip
    );
    const pwOk = timingSafeEqual(parsed.data.password, env.APP_PASSWORD);
    if (turnstileOk && pwOk) {
      await recordAttempt(env.DB, ip, true);
      const token = await signJwt({ jti: newJti() }, env.JWT_SECRET, {
        expSeconds: SESSION_MAX_AGE_SECONDS
      });
      await applyFloor(started);
      return {
        kind: 'response',
        response: new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': buildSessionCookie(token) }
        })
      };
    }
    await recordAttempt(env.DB, ip, false);
    await applyFloor(started);
    return { kind: 'error', message: '로그인에 실패했습니다.' };
  } catch {
    logger.error({
      route: '/login',
      method: 'POST',
      status: 500,
      latencyMs: Date.now() - started,
      jti: 'login_post_error'
    });
    await applyFloor(started);
    return {
      kind: 'response',
      response: new Response('Internal Server Error', { status: 500 })
    };
  }
}
