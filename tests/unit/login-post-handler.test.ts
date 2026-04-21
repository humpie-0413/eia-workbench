import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LOGIN_MIN_RESPONSE_MS } from '@/lib/constants';

// Node/V8 timers on Windows have ~1-2ms precision, so Date.now() around a
// setTimeout(_, 300) occasionally rounds down to 299ms even when the floor
// fired correctly. We assert with a small negative tolerance to avoid flakes.
// The production floor logic itself is exact (LOGIN_MIN_RESPONSE_MS - elapsed).
const FLOOR_TOLERANCE_MS = 5;
const flooredAtLeast = (elapsed: number): boolean =>
  elapsed >= LOGIN_MIN_RESPONSE_MS - FLOOR_TOLERANCE_MS;

// vi.mock is hoisted, so factory cannot reference out-of-scope bindings here;
// the individual tests reconfigure behaviour via mockImplementation below.
vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstile: vi.fn()
}));
vi.mock('@/lib/auth/rate-limit', () => ({
  isBlocked: vi.fn(async () => false),
  recordAttempt: vi.fn(async () => undefined)
}));
vi.mock('@/lib/auth/jwt', () => ({
  signJwt: vi.fn(async () => 'signed.jwt.token')
}));

import { handleLoginPost } from '@/pages/login.post-handler';
import { verifyTurnstile } from '@/lib/auth/turnstile';

const TURNSTILE_MOCK = verifyTurnstile as unknown as ReturnType<typeof vi.fn>;

function fakeEnv(): Env {
  return {
    DB: {} as unknown as D1Database,
    UPLOADS: {} as unknown as R2Bucket,
    APP_PASSWORD: 'correct-horse-battery-staple',
    JWT_SECRET: 'x'.repeat(32),
    TURNSTILE_SECRET_KEY: 'secret',
    TURNSTILE_SITE_KEY: 'sitekey',
    APP_ORIGIN: 'http://localhost:3000'
  };
}

function postRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
}

describe('handleLoginPost', () => {
  beforeEach(() => {
    TURNSTILE_MOCK.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('enforces 300ms floor when verifyTurnstile throws (network error)', async () => {
    TURNSTILE_MOCK.mockImplementation(async () => {
      throw new Error('network');
    });
    const req = postRequest({
      password: 'correct-horse-battery-staple',
      'cf-turnstile-response': 'tok'
    });
    const t0 = Date.now();
    const result = await handleLoginPost(req, fakeEnv(), '1.2.3.4');
    const elapsed = Date.now() - t0;

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') throw new Error('unreachable');
    expect(result.response.status).toBe(500);
    expect(flooredAtLeast(elapsed)).toBe(true);
  });

  it('returns 500 on internal error without leaking exception detail', async () => {
    const secret = 'very-unique-exception-string-abcdef';
    TURNSTILE_MOCK.mockImplementation(async () => {
      throw new Error(secret);
    });
    const req = postRequest({
      password: 'correct-horse-battery-staple',
      'cf-turnstile-response': 'tok'
    });
    const result = await handleLoginPost(req, fakeEnv(), '1.2.3.4');

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') throw new Error('unreachable');
    expect(result.response.status).toBe(500);
    const body = await result.response.text();
    expect(body).not.toContain(secret);
    expect(body).toBe('Internal Server Error');
  });

  it('enforces 300ms floor on successful login path', async () => {
    TURNSTILE_MOCK.mockImplementation(async () => true);
    const req = postRequest({
      password: 'correct-horse-battery-staple',
      'cf-turnstile-response': 'tok'
    });
    const t0 = Date.now();
    const result = await handleLoginPost(req, fakeEnv(), '1.2.3.4');
    const elapsed = Date.now() - t0;

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') throw new Error('unreachable');
    expect(result.response.status).toBe(303);
    expect(result.response.headers.get('location')).toBe('/');
    expect(flooredAtLeast(elapsed)).toBe(true);
  });

  it('enforces 300ms floor on reject path (bad password)', async () => {
    TURNSTILE_MOCK.mockImplementation(async () => true);
    const req = postRequest({
      password: 'wrong-password',
      'cf-turnstile-response': 'tok'
    });
    const t0 = Date.now();
    const result = await handleLoginPost(req, fakeEnv(), '1.2.3.4');
    const elapsed = Date.now() - t0;

    expect(result.kind).toBe('error');
    expect(flooredAtLeast(elapsed)).toBe(true);
  });
});
