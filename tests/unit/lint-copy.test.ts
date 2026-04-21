import { describe, expect, it } from 'vitest';
import { detectLegalAssertion, FORBIDDEN_ASSERTION_REGEX } from '@/lib/lint-copy';

describe('detectLegalAssertion', () => {
  it('flags "환경영향평가 대상입니다"', () => {
    expect(detectLegalAssertion('이 사업은 환경영향평가 대상입니다.')).toHaveLength(1);
  });

  it('flags "협의 통과"', () => {
    expect(detectLegalAssertion('협의 통과되었습니다')).toHaveLength(1);
  });

  it('flags "승인됨"', () => {
    expect(detectLegalAssertion('검토 결과 승인됨')).toHaveLength(1);
  });

  it('flags "법적으로 문제없음"', () => {
    expect(detectLegalAssertion('법적으로 문제 없습니다')).toHaveLength(1);
  });

  it('flags "자동으로 완료되어 안전"', () => {
    expect(detectLegalAssertion('AI가 자동으로 작성을 완료했으며 안전합니다')).toHaveLength(1);
  });

  it('passes safe conditional phrasing', () => {
    expect(detectLegalAssertion('대상 가능성이 있어 전문가 확인이 필요합니다')).toHaveLength(0);
  });

  it('passes "보완 리스크를 낮추는 체크 항목"', () => {
    expect(detectLegalAssertion('보완 리스크를 낮추는 체크 항목입니다')).toHaveLength(0);
  });

  it('passes empty string', () => {
    expect(detectLegalAssertion('')).toHaveLength(0);
  });

  it('exposes FORBIDDEN_ASSERTION_REGEX for external grep scripts', () => {
    expect(FORBIDDEN_ASSERTION_REGEX).toBeInstanceOf(RegExp);
    expect(FORBIDDEN_ASSERTION_REGEX.flags).toContain('g');
  });
});
