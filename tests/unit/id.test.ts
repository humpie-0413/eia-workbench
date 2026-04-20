import { describe, it, expect } from 'vitest';
import { newProjectId, newUploadId, newR2Suffix, newJti } from '@/lib/id';

describe('id utilities', () => {
  it('projectId is 12 chars URL-safe', () => {
    const id = newProjectId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
  it('uploadId is 12 chars URL-safe', () => {
    expect(newUploadId()).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
  it('r2 suffix is 16 chars URL-safe', () => {
    expect(newR2Suffix()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
  it('jti is 21 chars URL-safe', () => {
    expect(newJti()).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
  it('ids are unique across 1000 calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newProjectId()));
    expect(set.size).toBe(1000);
  });
});
