import type { MiddlewareHandler } from 'astro';
import { parseSessionCookie } from '@/lib/auth/session';
import { verifyJwt } from '@/lib/auth/jwt';

const PUBLIC_PATHS = new Set(['/login', '/logout']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request, locals, redirect } = context;
  const env = locals.runtime.env;
  const method = request.method.toUpperCase();
  const isApi = url.pathname.startsWith('/api/');
  const isPublic = PUBLIC_PATHS.has(url.pathname);

  if (MUTATING.has(method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== env.APP_ORIGIN) {
      return new Response('origin mismatch', { status: 403 });
    }
  }

  if (!isPublic) {
    const token = parseSessionCookie(request.headers.get('cookie'));
    const payload = token ? await verifyJwt(token, env.JWT_SECRET) : null;
    if (!payload) {
      if (isApi) return new Response('unauthorized', { status: 401 });
      return redirect('/login');
    }
    locals.session = { jti: payload.jti };
  }

  const res = await next();

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/html')) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(k, v);
    }
  }
  return res;
};
