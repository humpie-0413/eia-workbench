// src/features/similar-cases/sigungu-lut.test.ts
//
// sigungu-lut.json schema 검증 (보강 3, Phase 1 LUT 19 entry 확장).
// 모든 entry 가 not-null + sidoCode/sido pair 가 SIDO_LUT 와 정합 + step 2.5
// priority 위반 가능 substring 충돌 0 인지 확인.
import { describe, it, expect } from 'vitest';
import lut from '../../../data/region/sigungu-lut.json';
import { SIDO_LUT } from './sido-lut';

type LutEntry = { sido: string; sidoCode: string; sigungu: string };

describe('sigungu-lut schema', () => {
  it('19 entries (6 existing + 13 expanded)', () => {
    expect(Object.keys(lut).length).toBe(19);
  });

  it('every entry has non-empty sido / sidoCode / sigungu', () => {
    for (const [stem, entry] of Object.entries(lut)) {
      const e = entry as Partial<LutEntry>;
      expect(typeof e.sido, `${stem}.sido type`).toBe('string');
      expect(typeof e.sidoCode, `${stem}.sidoCode type`).toBe('string');
      expect(typeof e.sigungu, `${stem}.sigungu type`).toBe('string');
      expect(e.sido, `${stem}.sido empty`).not.toBe('');
      expect(e.sidoCode, `${stem}.sidoCode empty`).not.toBe('');
      expect(e.sigungu, `${stem}.sigungu empty`).not.toBe('');
    }
  });

  it('sidoCode 가 SIDO_LUT.code 에 존재 (cross-LUT consistency)', () => {
    const validCodes = new Set<string>(SIDO_LUT.map((s) => s.code));
    for (const [stem, entry] of Object.entries(lut)) {
      const e = entry as LutEntry;
      expect(
        validCodes.has(e.sidoCode),
        `${stem}.sidoCode "${e.sidoCode}" not in SIDO_LUT codes`
      ).toBe(true);
    }
  });

  it('sido (legacy label) 가 SIDO_LUT.legacyLabel 과 sidoCode 기준 정합', () => {
    // sigungu-lut.json convention: sido = legacyLabel ('강원도', '제주도', '전라북도').
    // canonical label ('강원특별자치도') 회피로 D1 region_sido drift 방지.
    const codeToLegacyLabel = new Map<string, string>(SIDO_LUT.map((s) => [s.code, s.legacyLabel]));
    for (const [stem, entry] of Object.entries(lut)) {
      const e = entry as LutEntry;
      expect(e.sido, `${stem} (sidoCode=${e.sidoCode})`).toBe(codeToLegacyLabel.get(e.sidoCode));
    }
  });

  it('서귀포 stem 이 제주 stem 보다 먼저 등장 (Object.keys insertion order)', () => {
    // step 2.5 LUT iteration 은 Object.keys 순서. "제주특별자치도 서귀포 OO풍력" 같은
    // bizNm 에서 서귀포 가 먼저 매치되도록 JSON 작성 순서 강제.
    const keys = Object.keys(lut);
    const seoguipoIdx = keys.indexOf('서귀포');
    const jejuIdx = keys.indexOf('제주');
    expect(seoguipoIdx).toBeGreaterThanOrEqual(0);
    expect(jejuIdx).toBeGreaterThanOrEqual(0);
    expect(seoguipoIdx).toBeLessThan(jejuIdx);
  });

  it('19 stem pairwise — substring 충돌 시 priority 위반 0 (spec §4.4.7)', () => {
    // 짧은 stem A 가 긴 stem B 의 substring 인 경우, A 가 keys 에서 B 보다 먼저 등장하면
    // step 2.5 에서 A 가 잘못 매치될 수 있음. v1 LUT 확장 시 충돌 발견하면 더 긴 stem
    // 우선 정렬 또는 명시적 priority 필드 추가 필요. 현 19 entry 는 0 충돌.
    const stems = Object.keys(lut);
    const conflicts: string[] = [];
    for (const a of stems) {
      for (const b of stems) {
        if (a === b) continue;
        if (a.length < b.length && b.includes(a)) {
          const ai = stems.indexOf(a);
          const bi = stems.indexOf(b);
          if (ai < bi) {
            conflicts.push(`"${a}" (idx ${ai}) ⊂ "${b}" (idx ${bi}) — 짧은 stem 우선 등장`);
          }
        }
      }
    }
    expect(conflicts).toEqual([]);
  });
});
