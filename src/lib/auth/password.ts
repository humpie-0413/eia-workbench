export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    const x = ba[i] ?? 0;
    const y = bb[i] ?? 0;
    diff |= x ^ y;
  }
  return diff === 0;
}
