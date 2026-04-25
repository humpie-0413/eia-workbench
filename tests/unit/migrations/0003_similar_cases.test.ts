import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDb(): Database.Database {
  const db = new Database(':memory:');
  for (const f of ['0001_init.sql', '0002_scoping.sql', '0003_similar_cases.sql']) {
    const sql = readFileSync(resolve('migrations', f), 'utf-8');
    db.exec(sql);
  }
  return db;
}

describe('migrations/0003_similar_cases.sql', () => {
  it('creates eia_cases + FTS5 + sync table + triggers + indexes', () => {
    const db = loadDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['eia_cases', 'eia_cases_fts', 'eia_cases_sync']));

    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='eia_cases'")
      .all();
    expect(idx.length).toBeGreaterThanOrEqual(4);

    const trg = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='eia_cases'")
      .all();
    expect(trg.length).toBeGreaterThanOrEqual(3);
  });

  it('CHECK constraint rejects non-onshore_wind industry', () => {
    const db = loadDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO eia_cases (eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm, industry, evaluation_stage, source_dataset, source_payload)
           VALUES ('X', 'C', '에너지', '풍력', 'solar', '본안', '15142998', '{}')`
        )
        .run()
    ).toThrow(/CHECK/);
  });

  it('CHECK constraint rejects biz_gubun_cd not in (C, L)', () => {
    const db = loadDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO eia_cases (eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm, industry, evaluation_stage, source_dataset, source_payload)
           VALUES ('Y', 'Z', '기타', '풍력', 'onshore_wind', '본안', '15142998', '{}')`
        )
        .run()
    ).toThrow(/CHECK/);
  });

  it('CHECK constraint rejects evaluation_stage outside (본안, 전략)', () => {
    const db = loadDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO eia_cases (eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm, industry, evaluation_stage, source_dataset, source_payload)
           VALUES ('Z', 'C', '에너지', '풍력', 'onshore_wind', '본조사', '15142998', '{}')`
        )
        .run()
    ).toThrow(/CHECK/);
  });

  it('FTS5 trigger syncs biz_nm on insert (search returns row)', () => {
    const db = loadDb();
    db.prepare(
      `INSERT INTO eia_cases (eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm, industry, region_sido, region_sigungu, evaluation_stage, source_dataset, source_payload)
       VALUES ('A1', 'C', '에너지개발', '강원평창풍력', 'onshore_wind', '강원', '평창군', '본안', '15142998', '{}')`
    ).run();
    const hits = db
      .prepare("SELECT eia_cd FROM eia_cases WHERE rowid IN (SELECT rowid FROM eia_cases_fts WHERE eia_cases_fts MATCH ?)")
      .all('강원평창풍력') as Array<{ eia_cd: string }>;
    expect(hits.length).toBe(1);
    expect(hits[0]!.eia_cd).toBe('A1');
  });
});
