import { describe, it, expect } from 'vitest';
import { projectCreateSchema, loginSchema, uploadMetaSchema } from '@/lib/schemas';

describe('projectCreateSchema', () => {
  it('accepts a minimal valid input', () => {
    const r = projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind' });
    expect(r.success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(projectCreateSchema.safeParse({ name: '', industry: 'onshore_wind' }).success).toBe(false);
  });
  it('rejects name > 200 chars', () => {
    const r = projectCreateSchema.safeParse({ name: 'x'.repeat(201), industry: 'onshore_wind' });
    expect(r.success).toBe(false);
  });
  it('rejects industry other than onshore_wind', () => {
    const r = projectCreateSchema.safeParse({ name: 'A', industry: 'solar' });
    expect(r.success).toBe(false);
  });
  it('rejects capacity_mw out of range', () => {
    expect(projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind', capacity_mw: -1 }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind', capacity_mw: 10001 }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires password and turnstileToken', () => {
    expect(loginSchema.safeParse({ password: 'p', turnstileToken: 't' }).success).toBe(true);
    expect(loginSchema.safeParse({ password: 'p' }).success).toBe(false);
  });
});

describe('uploadMetaSchema', () => {
  it('accepts allowed mime', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.pdf',
      mime: 'application/pdf',
      size_bytes: 1024
    });
    expect(r.success).toBe(true);
  });
  it('rejects HWP mime', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.hwp',
      mime: 'application/x-hwp',
      size_bytes: 1024
    });
    expect(r.success).toBe(false);
  });
  it('rejects size over MAX_FILE_BYTES', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.pdf',
      mime: 'application/pdf',
      size_bytes: 31 * 1024 * 1024
    });
    expect(r.success).toBe(false);
  });
});
