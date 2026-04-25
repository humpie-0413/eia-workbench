import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migration 0002_scoping.sql', () => {
  const sql = readFileSync(resolve('migrations/0002_scoping.sql'), 'utf8');

  it('creates scoping_runs table', () => {
    expect(sql).toMatch(/CREATE TABLE scoping_runs/);
  });

  it('declares required columns', () => {
    expect(sql).toMatch(/id\s+TEXT\s+PRIMARY KEY/);
    expect(sql).toMatch(/project_id\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/rule_pack_version\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/input_json\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/output_json\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/created_at\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/deleted_at\s+TEXT/);
  });

  it('declares foreign key to projects', () => {
    expect(sql).toMatch(/REFERENCES\s+projects\s*\(\s*id\s*\)/);
  });

  it('creates performance indexes', () => {
    expect(sql).toMatch(/CREATE INDEX\s+scoping_runs_project[\s\S]+project_id/);
    expect(sql).toMatch(/CREATE INDEX\s+scoping_runs_deleted[\s\S]+deleted_at/);
  });
});
