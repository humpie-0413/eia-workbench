import { SESSION_MAX_AGE_SECONDS } from '../constants';

export const SESSION_COOKIE = 'eia_session';

export function buildSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ].join('; ');
}

export function buildLogoutCookie(): string {
  return [`${SESSION_COOKIE}=`, 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=0'].join(
    '; '
  );
}

export function parseSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const kv of header.split(';')) {
    const [k, v] = kv.trim().split('=');
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}
