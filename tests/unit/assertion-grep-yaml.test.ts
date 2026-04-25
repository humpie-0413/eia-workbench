import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { detectLegalAssertion } from '@/lib/lint-copy';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.yaml') || name.endsWith('.yml')) out.push(p);
  }
  return out;
}

describe('rule pack YAML assertion-phrase scan (v2 T22)', () => {
  it('scripts/assertion-grep.sh data/rules branch — live packs are clean', () => {
    const yamls = walk('data/rules');
    expect(yamls.length).toBeGreaterThan(0);
    for (const f of yamls) {
      const hits = detectLegalAssertion(readFileSync(f, 'utf-8'));
      expect(hits, `${f} must not contain legal-conclusion phrases`).toHaveLength(0);
    }
  });

  it('detector itself catches banned phrases in a synthetic YAML snippet', () => {
    const bad = [
      'title: 이 사업은 환경영향평가 대상입니다',
      'basis:',
      '  - title: 협의 통과 사례'
    ].join('\n');
    expect(detectLegalAssertion(bad).length).toBeGreaterThanOrEqual(2);
  });
});
