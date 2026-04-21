#!/usr/bin/env bash
# Verify that `npm run build` emitted a CSS bundle with both Tailwind
# preflight and the project's global.css tokens. Run after `astro build`.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DIST_ASTRO="dist/_astro"

if [ ! -d "$DIST_ASTRO" ]; then
  echo "FAIL: $DIST_ASTRO missing. Did you run 'npm run build'?" >&2
  exit 1
fi

shopt -s nullglob
css_files=("$DIST_ASTRO"/*.css)

if [ "${#css_files[@]}" -eq 0 ]; then
  echo "FAIL: no CSS file in $DIST_ASTRO. Global stylesheet not wired into the build graph." >&2
  echo "      Check that layouts import '../styles/global.css' in the frontmatter." >&2
  exit 1
fi

# Two independent signals must appear in the same CSS bundle:
#   Signal 1 (Tailwind preflight compiled): 'box-sizing:border-box' OR '--tw-' var family.
#   Signal 2 (global.css tokens reached graph): '--c-bg' or '--c-primary' CSS vars declared in src/styles/global.css :root.
# Both missing would mean empty CSS. Only one missing indicates a partial wiring bug.
preflight_found=0
tokens_found=0
preflight_file=""
tokens_file=""

for f in "${css_files[@]}"; do
  if [ "$preflight_found" -eq 0 ] && grep -qE 'box-sizing:[[:space:]]*border-box|--tw-' "$f"; then
    preflight_found=1
    preflight_file="$f"
  fi
  if [ "$tokens_found" -eq 0 ] && grep -qE -- '--c-bg|--c-primary' "$f"; then
    tokens_found=1
    tokens_file="$f"
  fi
done

if [ "$preflight_found" -eq 0 ]; then
  echo "FAIL: no Tailwind preflight in emitted CSS." >&2
  echo "      Expected 'box-sizing:border-box' or '--tw-*' somewhere in $DIST_ASTRO/*.css." >&2
  echo "      Symptom: @tailwind base; directive did not run. Check that global.css is imported." >&2
  exit 1
fi

if [ "$tokens_found" -eq 0 ]; then
  echo "FAIL: global.css project tokens (--c-bg / --c-primary) missing from emitted CSS." >&2
  echo "      Symptom: src/styles/global.css is not in the build graph." >&2
  echo "      Fix: ensure the frontmatter imports '../styles/global.css'." >&2
  exit 1
fi

echo "OK: ${#css_files[@]} CSS file(s); preflight in $(basename "$preflight_file"); tokens in $(basename "$tokens_file")."
