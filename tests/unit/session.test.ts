import { describe, it, expect } from 'vitest';
import { buildSessionCookie, parseSessionCookie, buildLogoutCookie } from '@/lib/auth/session';

describe('session cookie', () => {
  it('buildSessionCookie has HttpOnly, Secure, SameSite=Lax, Max-Age', () => {
    const c = buildSessionCookie('tok');
    expect(c).toMatch(/eia_session=tok/);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).toMatch(/Max-Age=604800/);
    expect(c).toMatch(/Path=\//);
  });

  it('buildLogoutCookie has Max-Age=0', () => {
    expect(buildLogoutCookie()).toMatch(/Max-Age=0/);
  });

  it('parseSessionCookie extracts token', () => {
    expect(parseSessionCookie('a=1; eia_session=tok; b=2')).toBe('tok');
  });

  it('parseSessionCookie returns null when missing', () => {
    expect(parseSessionCookie('a=1; b=2')).toBe(null);
  });
});
