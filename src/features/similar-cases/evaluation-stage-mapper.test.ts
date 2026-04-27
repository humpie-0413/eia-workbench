// src/features/similar-cases/evaluation-stage-mapper.test.ts
import { describe, it, expect } from 'vitest';
import { mapEvaluationStage } from './evaluation-stage-mapper';

describe('mapEvaluationStage', () => {
  it('빈 items 배열 → unknown', () => {
    expect(mapEvaluationStage([])).toBe('unknown');
  });

  it('undefined → unknown (defensive)', () => {
    expect(mapEvaluationStage(undefined)).toBe('unknown');
  });

  it('stateNm "전략환경영향평가" → 전략', () => {
    expect(mapEvaluationStage([{ stateNm: '전략환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('전략');
  });

  it('stateNm "1차 협의" → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '1차 협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "변경협의" → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '변경협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "협의" (정확 일치) → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "소규모환경영향평가" → unknown', () => {
    expect(mapEvaluationStage([{ stateNm: '소규모환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('unknown');
  });

  it('정렬 — resReplyDt DESC 우선, items[0] 기준 매핑', () => {
    const result = mapEvaluationStage([
      { stateNm: '소규모', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '전략', resReplyDt: '2025-06-01', applyDt: '2024-01-01' }
    ]);
    expect(result).toBe('전략'); // resReplyDt 2025-06-01 가 더 최신 → first
  });

  it('정렬 — resReplyDt 동일 시 applyDt DESC fallback', () => {
    const result = mapEvaluationStage([
      { stateNm: '소규모', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2025-06-01' }
    ]);
    expect(result).toBe('본안');
  });

  it('정렬 — 둘 다 동일 시 API order (배열 순서) 첫째', () => {
    const result = mapEvaluationStage([
      { stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '전략', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }
    ]);
    expect(result).toBe('본안');
  });
});
