import { describe, it, expect } from 'vitest';
import type {
  Citation,
  StandardAnalysisResult,
  ScopingResult,
} from './analysis-result';

describe('analysis-result types', () => {
  it('Citation shape compiles', () => {
    const c: Citation = {
      id: 'eia_decree_annex3',
      title: '환경영향평가법 시행령 별표 3',
      refLink: 'https://law.go.kr/',
      citation_url: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=34819077',
    };
    expect(c.id).toBe('eia_decree_annex3');
  });

  it('StandardAnalysisResult enforces needsHumanReview: true', () => {
    const r: StandardAnalysisResult = {
      result: 'needs_check',
      basis: [],
      assumptions: [],
      limits: [],
      needsHumanReview: true,
    };
    expect(r.needsHumanReview).toBe(true);
  });

  it('ScopingResult extends with triggered + rule_pack_version', () => {
    const sr: ScopingResult = {
      ruleId: 'eia_target_capacity',
      title: '환경영향평가 대상 — 발전시설용량 100 MW',
      category: 'eia_target',
      rule_pack_version: 'onshore_wind/v2.2026-04-23',
      result: 'likely_not_applicable',
      basis: [],
      assumptions: [],
      limits: [],
      needsHumanReview: true,
      triggered: false,
      skip_reason: 'input_undefined',
    };
    expect(sr.triggered).toBe(false);
    expect(sr.skip_reason).toBe('input_undefined');
  });

  it('result enum accepts all 5 values', () => {
    const values: StandardAnalysisResult['result'][] = [
      'likely_applicable',
      'needs_check',
      'likely_not_applicable',
      'unknown',
      'skipped',
    ];
    expect(values).toHaveLength(5);
  });
});
