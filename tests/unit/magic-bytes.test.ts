import { describe, it, expect } from 'vitest';
import { validateMagicBytes } from '@/lib/upload/magic-bytes';

function bytes(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g);
  if (m === null) throw new Error(`invalid hex: ${hex}`);
  return new Uint8Array(m.map((h) => parseInt(h, 16)));
}

describe('validateMagicBytes', () => {
  it('accepts PDF magic %PDF-', async () => {
    expect(await validateMagicBytes(bytes('255044462d312e34'), 'application/pdf')).toBe(true);
  });
  it('rejects PDF mime with non-PDF content', async () => {
    expect(await validateMagicBytes(bytes('deadbeef'), 'application/pdf')).toBe(false);
  });
  it('accepts DOCX (zip + [Content_Types].xml entry)', async () => {
    const docx = await makeMinimalDocx();
    expect(
      await validateMagicBytes(
        docx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(true);
  });
  it('rejects DOCX mime with generic zip', async () => {
    const zip = await makeGenericZip();
    expect(
      await validateMagicBytes(
        zip,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(false);
  });
  it('accepts valid UTF-8 for text/plain', async () => {
    expect(await validateMagicBytes(new TextEncoder().encode('안녕'), 'text/plain')).toBe(true);
  });
  it('rejects invalid UTF-8 for text/plain', async () => {
    expect(await validateMagicBytes(new Uint8Array([0xff, 0xfe, 0xfd]), 'text/plain')).toBe(false);
  });
  it('accepts an exact-fit minimal DOCX (zero trailing content)', async () => {
    // Single [Content_Types].xml entry, zero-length content body.
    // Exercises the off-by-one boundary: zip.length === 30 + target.length.
    const name = '[Content_Types].xml';
    const fname = new TextEncoder().encode(name);
    const buf = new Uint8Array(30 + fname.length);
    buf.set([0x50, 0x4b, 0x03, 0x04], 0);
    new DataView(buf.buffer).setUint16(26, fname.length, true);
    buf.set(fname, 30);
    expect(
      await validateMagicBytes(buf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    ).toBe(true);
  });

  it('rejects a 30MB DOCX-mime payload quickly (DoS bound)', async () => {
    // 30 MiB of PK\x03\x04-like garbage without [Content_Types].xml.
    // Tests that hasEntry bounds the scan so this completes within a reasonable CPU budget.
    const big = new Uint8Array(30 * 1024 * 1024);
    // Sprinkle fake PK headers every 200 bytes to stress the outer loop.
    for (let i = 0; i + 4 < big.length; i += 200) {
      big.set([0x50, 0x4b, 0x03, 0x04], i);
    }
    const t0 = Date.now();
    const result = await validateMagicBytes(
      big,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const elapsed = Date.now() - t0;
    expect(result).toBe(false);
    // Bound is 64 KiB = 327 iterations of the 200-byte stride. Should complete
    // in well under 50ms even on a slow CI runner. Allow 250ms for safety.
    expect(elapsed).toBeLessThan(250);
  });
});

async function makeMinimalDocx(): Promise<Uint8Array> {
  const name = '[Content_Types].xml';
  const content = new TextEncoder().encode('<?xml version="1.0"?><Types/>');
  const fname = new TextEncoder().encode(name);
  const header = new Uint8Array(30 + fname.length + content.length);
  header.set([0x50, 0x4b, 0x03, 0x04], 0);
  new DataView(header.buffer).setUint16(26, fname.length, true);
  new DataView(header.buffer).setUint16(28, 0, true);
  header.set(fname, 30);
  header.set(content, 30 + fname.length);
  return header;
}

async function makeGenericZip(): Promise<Uint8Array> {
  const fname = new TextEncoder().encode('readme.txt');
  const header = new Uint8Array(30 + fname.length);
  header.set([0x50, 0x4b, 0x03, 0x04], 0);
  new DataView(header.buffer).setUint16(26, fname.length, true);
  header.set(fname, 30);
  return header;
}
