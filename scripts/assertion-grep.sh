#!/usr/bin/env bash
set -euo pipefail

# Legal-conclusion assertions that MUST NOT appear in shipped UI/copy.
PATTERN='환경영향평가\s*대상입니다|협의\s*통과|승인됨|법적으로\s*문제\s*없|자동.*(완료|작성).*(안전|문제없)'

# Paid LLM API key references are forbidden (CLAUDE.md §2-2 / §9.2).
PAID_KEYS='ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY'

# lint-copy.ts / lint-copy.test.ts deliberately contain the banned patterns as DATA
# (regex strings and test fixtures) — not as UI assertions. Exclude them from the scan.
fail=0
for dir in src workers tests/e2e; do
  if [ -d "$dir" ]; then
    if grep -E -rn "$PATTERN" "$dir" \
        --exclude='lint-copy.ts' \
        --exclude='lint-copy.test.ts' \
        2>/dev/null; then
      echo "::error::Forbidden legal-conclusion expression found in $dir"
      fail=1
    fi
  fi
done

for dir in src workers; do
  if [ -d "$dir" ]; then
    if grep -E -rn "$PAID_KEYS" "$dir" 2>/dev/null; then
      echo "::error::Paid LLM API key reference found in $dir (violates CLAUDE.md §2-2 / §9.2)"
      fail=1
    fi
  fi
done

if [ $fail -eq 0 ]; then
  echo "assertion-grep: clean"
fi

exit $fail
