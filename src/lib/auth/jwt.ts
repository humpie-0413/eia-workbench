function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface JwtPayload {
  jti: string;
  iat: number;
  exp: number;
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'> & Partial<Pick<JwtPayload, 'iat' | 'exp'>>,
  secret: string,
  opts: { expSeconds: number }
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = {
    jti: payload.jti,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + opts.expSeconds
  };
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(full)));
  const data = enc.encode(`${h}.${p}`);
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  return `${h}.${p}.${b64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  // Under noUncheckedIndexedAccess, destructured values are `string | undefined`.
  // Narrow before use — the `parts.length !== 3` guard doesn't refine element types.
  if (h === undefined || p === undefined || s === undefined) return null;
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, fromB64url(s), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromB64url(p))) as JwtPayload;
    if (typeof payload.jti !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
