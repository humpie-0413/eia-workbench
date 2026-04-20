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
