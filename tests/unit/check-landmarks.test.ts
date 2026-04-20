import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkLandmarks } from '@/lib/check-landmarks';

const read = (p: string): string => readFileSync(resolve(p), 'utf8');

describe('checkLandmarks', () => {
  it('returns ok when all patterns match', () => {
    const r = checkLandmarks('<main><aside aria-label="x">z</aside></main>', [
      { label: 'main', pattern: /<main[\s>]/ },
      { label: 'aside with label', pattern: /<aside[^>]*aria-label=/ }
    ]);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('lists each missing requirement by label', () => {
    const r = checkLandmarks('<div>no landmarks</div>', [
      { label: 'main', pattern: /<main[\s>]/ },
      { label: 'aside', pattern: /<aside[\s>]/ }
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['main', 'aside']);
  });
});

describe('Astro layout landmark invariants', () => {
  it('AppLayout.astro exposes main, aside-with-label, and header', () => {
    const src = read('src/layouts/AppLayout.astro');
    const r = checkLandmarks(src, [
      { label: '<main>', pattern: /<main[\s>]/ },
      { label: '<aside aria-label="...">', pattern: /<aside[^>]*aria-label=/ },
      { label: '<header>', pattern: /<header[\s>]/ }
    ]);
    expect(r.ok, `AppLayout missing: ${r.missing.join(', ')}`).toBe(true);
  });

  it('AuthLayout.astro exposes main and a named head slot', () => {
    const src = read('src/layouts/AuthLayout.astro');
    const r = checkLandmarks(src, [
      { label: '<main>', pattern: /<main[\s>]/ },
      { label: '<slot name="head">', pattern: /<slot\s+name="head"/ }
    ]);
    expect(r.ok, `AuthLayout missing: ${r.missing.join(', ')}`).toBe(true);
  });

  it('login.astro uses AuthLayout and ships no bare <body>', () => {
    const src = read('src/pages/login.astro');
    expect(src).toMatch(/<AuthLayout[\s>]/);
    expect(src).not.toMatch(/<body[\s>]/);
  });

  it('project detail tablist declares an accessible name', () => {
    const src = read('src/pages/projects/[id].astro');
    expect(src).toMatch(/role="tablist"[^>]*aria-label=/);
  });
});
