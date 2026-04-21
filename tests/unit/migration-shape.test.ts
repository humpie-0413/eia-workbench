import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migration 0001_init.sql', () => {
  const sql = readFileSync(resolve('migrations/0001_init.sql'), 'utf8');

  it('creates projects, uploads, login_attempts tables', () => {
    expect(sql).toMatch(/CREATE TABLE projects/);
    expect(sql).toMatch(/CREATE TABLE uploads/);
    expect(sql).toMatch(/CREATE TABLE login_attempts/);
  });

  it('constrains industry to onshore_wind', () => {
    expect(sql).toMatch(/CHECK\(industry\s+IN\s*\(\s*'onshore_wind'\s*\)\)/);
  });

  it('declares owner_id on projects (v1 placeholder)', () => {
    expect(sql).toMatch(/owner_id\s+TEXT/);
  });

  it('declares sha256 column and partial unique index', () => {
    expect(sql).toMatch(/sha256\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/uploads_project_sha_alive[\s\S]+WHERE\s+deleted_at\s+IS\s+NULL/);
  });
});
