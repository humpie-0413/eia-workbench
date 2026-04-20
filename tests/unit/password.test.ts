import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from '@/lib/auth/password';

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
  });
  it('returns false for different strings of equal length', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
  });
  it('returns false for different-length inputs', () => {
    expect(timingSafeEqual('short', 'longerstring')).toBe(false);
  });
  it('handles empty inputs', () => {
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('', 'x')).toBe(false);
  });
  it('uses constant-time byte comparison (does not short-circuit)', () => {
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('aXcdef', 'abcdef')).toBe(false);
  });
});
