import type { APIContext, MiddlewareNext } from 'astro';
import { describe, it, expect, vi } from 'vitest';
import { onRequest as onRequestRaw } from '@/middleware';

// Narrow the MiddlewareHandler union (Promise<Response> | Response | Promise<void> | void)
// to Promise<Response>. Our implementation always returns a Response, so this cast is safe
// and avoids sprinkling type-guards across every test body.
const onRequest = onRequestRaw as unknown as (
  ctx: APIContext,
  next: MiddlewareNext
) => Promise<Response>;

type MockCtx = {
  url: URL;
  request: Request;
  locals: App.Locals;
  redirect(path: string): Response;
};

function ctx(
  url: string,
  init?: RequestInit & { cookie?: string; origin?: string },
  runtime?: Partial<Env>
): MockCtx {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set('cookie', init.cookie);
  if (init?.origin) headers.set('origin', init.origin);
  return {
    url: new URL(url),
    request: new Request(url, { ...init, headers }),
    locals: {
      runtime: {
        env: { APP_ORIGIN: 'http://localhost:3000', JWT_SECRET: 'x'.repeat(32), ...runtime }
      }
    } as unknown as App.Locals,
    redirect(path: string) {
      return new Response(null, { status: 302, headers: { location: path } });
    }
  };
}

describe('middleware', () => {
  it('adds CSP and X-Frame-Options to HTML response', async () => {
    const next = vi.fn(
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    );
    const res = await onRequest(
      ctx('http://localhost:3000/login') as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('blocks POST with mismatched Origin', async () => {
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest(
      ctx('http://localhost:3000/api/projects', {
        method: 'POST',
        origin: 'http://evil.example'
      }) as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not 403 a GET on Origin check (Origin check is mutating-only)', async () => {
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest(
      ctx('http://localhost:3000/api/projects', { method: 'GET' }) as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(res.status).not.toBe(403);
  });

  it('returns 401 for unauthenticated api requests', async () => {
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest(
      ctx('http://localhost:3000/api/projects', { method: 'GET' }) as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(res.status).toBe(401);
  });

  it('redirects unauthenticated page requests to /login', async () => {
    const next = vi.fn(
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    );
    const res = await onRequest(
      ctx('http://localhost:3000/') as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('allows /login without session', async () => {
    const next = vi.fn(
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    );
    const res = await onRequest(
      ctx('http://localhost:3000/login') as unknown as APIContext,
      next as unknown as MiddlewareNext
    );
    expect(next).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
