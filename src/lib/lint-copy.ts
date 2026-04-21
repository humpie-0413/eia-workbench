/**
 * Legal-assertion detector.
 *
 * DESIGN.md §7 forbids the project's UI/tests from asserting legal
 * conclusions ("환경영향평가 대상입니다", "승인됨", etc.). This module
 * exposes the regex and a helper that returns the list of matched
 * strings so unit tests and the pre-commit grep can both use it.
 */

/**
 * Stateful `/g` regex. `detectLegalAssertion` below clones this per call, but
 * external callers who use `.exec()` or `.test()` on it directly must reset
 * `lastIndex` themselves (or instantiate their own `new RegExp(source, flags)`).
 */
export const FORBIDDEN_ASSERTION_REGEX =
  /(환경영향평가\s*대상입니다|협의\s*통과|승인됨|법적으로\s*문제\s*없|자동.*(완료|작성).*(안전|문제없))/g;

export function detectLegalAssertion(text: string): string[] {
  if (text.length === 0) return [];
  const re = new RegExp(FORBIDDEN_ASSERTION_REGEX.source, FORBIDDEN_ASSERTION_REGEX.flags);
  return text.match(re) ?? [];
}
