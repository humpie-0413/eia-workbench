import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '@/lib/auth/jwt';

const SECRET = 'test-secret-32-characters-minimum-xxxxxxx';

describe('jwt HS256', () => {
  it('signs and verifies a payload', async () => {
    const token = await signJwt({ jti: 'abcdef12345678901234x' }, SECRET, { expSeconds: 60 });
    const payload = await verifyJwt(token, SECRET);
    expect(payload?.jti).toBe('abcdef12345678901234x');
  });

  it('rejects tampered payloads', async () => {
    const token = await signJwt({ jti: 'j1' }, SECRET, { expSeconds: 60 });
    const [h, , s] = token.split('.');
    const tampered = [h, btoa(JSON.stringify({ jti: 'evil' })).replace(/=+$/, ''), s].join('.');
    expect(await verifyJwt(tampered, SECRET)).toBe(null);
  });

  it('rejects wrong secret', async () => {
    const token = await signJwt({ jti: 'j2' }, SECRET, { expSeconds: 60 });
    expect(await verifyJwt(token, 'wrong-secret')).toBe(null);
  });

  it('rejects expired tokens', async () => {
    const token = await signJwt({ jti: 'j3' }, SECRET, { expSeconds: -1 });
    expect(await verifyJwt(token, SECRET)).toBe(null);
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyJwt('not.a.jwt', SECRET)).toBe(null);
    expect(await verifyJwt('only-one-part', SECRET)).toBe(null);
  });

  it('rejects tokens whose payload lacks exp', async () => {
    // Hand-craft a validly-signed token whose payload has no exp claim.
    const enc = new TextEncoder();
    const headerB = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payloadB = btoa(JSON.stringify({ jti: 'no-exp' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB}.${payloadB}`))
    );
    const sigB = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await verifyJwt(`${headerB}.${payloadB}.${sigB}`, SECRET)).toBe(null);
  });

  it('rejects tokens whose payload has non-string jti', async () => {
    const enc = new TextEncoder();
    const headerB = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payloadB = btoa(JSON.stringify({ jti: 123, exp: Math.floor(Date.now() / 1000) + 60 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB}.${payloadB}`))
    );
    const sigB = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await verifyJwt(`${headerB}.${payloadB}.${sigB}`, SECRET)).toBe(null);
  });
});
