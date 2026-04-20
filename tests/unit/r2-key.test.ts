import { describe, it, expect } from 'vitest';
import { buildR2Key } from '@/lib/upload/r2-key';

describe('buildR2Key', () => {
  it('uses projects/<pid>/<nanoid16> format', () => {
    const k = buildR2Key('abc123DEF456');
    expect(k).toMatch(/^projects\/abc123DEF456\/[A-Za-z0-9_-]{16}$/);
  });
  it('never includes the original filename', () => {
    const k = buildR2Key('p1');
    expect(k).not.toMatch(/\.pdf|\.docx|\.txt/);
  });
  it('is unique across 1000 calls for the same project', () => {
    const set = new Set(Array.from({ length: 1000 }, () => buildR2Key('p1')));
    expect(set.size).toBe(1000);
  });
});
