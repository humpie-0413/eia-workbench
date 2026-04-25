#!/usr/bin/env bash
set -euo pipefail

# Similar-cases-specific assertion guard (plan T32 / spec §10).
#
# Complements scripts/assertion-grep.sh (which scans the whole src/ tree) by
# narrowing focus to the /cases surface area + adding the feature-specific
# banned phrase "유사사례입니다" — a single-word claim that the existing
# global grep doesn't catch.
#
# Run locally: bash scripts/check-similar-cases-assertions.sh
# CI: invoked from .github/workflows/ci.yml right after assertion-grep.

TARGETS=(
  "src/components/cases"
  "src/pages/cases"
  "src/features/similar-cases"
)

PATTERNS='유사사례입니다|협의\s*통과|승인됨|법적으로\s*문제\s*없음|환경영향평가\s*대상입니다'

# markdown-export.test.ts asserts the export does NOT contain banned phrases —
# its failure-mode strings are part of the test, not user-facing UI copy.
EXCLUDES=(--exclude='markdown-export.test.ts')

fail=0
for dir in "${TARGETS[@]}"; do
  if [ -d "$dir" ]; then
    if grep -E -rn "$PATTERNS" "$dir" "${EXCLUDES[@]}" 2>/dev/null; then
      echo "::error::Forbidden assertion expression in $dir (similar-cases guard)"
      fail=1
    fi
  fi
done

if [ $fail -eq 0 ]; then
  echo "check-similar-cases-assertions: clean"
fi

exit $fail
