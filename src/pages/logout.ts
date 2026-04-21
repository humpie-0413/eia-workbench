import type { APIRoute } from 'astro';
import { buildLogoutCookie } from '@/lib/auth/session';

export const POST: APIRoute = async () =>
  new Response(null, {
    status: 303,
    headers: { location: '/login', 'set-cookie': buildLogoutCookie() }
  });

export const GET: APIRoute = () => new Response('method not allowed', { status: 405 });
