#!/usr/bin/env bash
# Verify wrangler.toml declares the [env.production.*] sections that
# Cloudflare Pages applies on `wrangler pages deploy --branch=<production>`.
#
# 5 signals, all required:
#   1. [env.production.vars] section exists
#   2. APP_ORIGIN inside it is a quoted https:// URL (not localhost)
#   3. TURNSTILE_SITE_KEY inside it is a non-empty quoted string
#   4. [[env.production.d1_databases]] exists (bindings are non-inheritable)
#   5. [[env.production.r2_buckets]] exists (bindings are non-inheritable)
#
# Why: Cloudflare treats `vars`, `d1_databases`, `r2_buckets` as
# non-inheritable. If [env.production.vars] overrides, the D1/R2 bindings
# must be explicitly restated under env.production.*, otherwise a production
# deploy silently falls back to top-level [vars] (local-dev values) or
# fails to bind DB/UPLOADS. See docs/plans/deploy-v0-wrangler-env-fix.md.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILE="wrangler.toml"
[ -f "$FILE" ] || { echo "FAIL: $FILE not found" >&2; exit 1; }

# Signal 1: [env.production.vars] section present.
if ! grep -qE '^\[env\.production\.vars\][[:space:]]*$' "$FILE"; then
  echo "FAIL: [env.production.vars] missing in $FILE." >&2
  echo "      Production deploys via --branch=<main> read this block for APP_ORIGIN / TURNSTILE_SITE_KEY." >&2
  exit 1
fi

# Extract the body of [env.production.vars] (until next [section] header).
block=$(awk '
  /^\[env\.production\.vars\][[:space:]]*$/ { in_block=1; next }
  /^\[/ && in_block { in_block=0 }
  in_block { print }
' "$FILE")

# Signal 2: APP_ORIGIN is a quoted https:// URL, not a dev URL.
origin_line=$(printf '%s\n' "$block" | grep -E '^[[:space:]]*APP_ORIGIN[[:space:]]*=' | head -1 || true)
if [ -z "$origin_line" ]; then
  echo "FAIL: APP_ORIGIN not declared under [env.production.vars]." >&2
  echo "      Symptom: middleware's Origin-match check rejects all state-changing POSTs (env.APP_ORIGIN undefined)." >&2
  exit 1
fi
if printf '%s' "$origin_line" | grep -qE 'localhost|127\.0\.0\.1|http://'; then
  echo "FAIL: APP_ORIGIN in [env.production.vars] looks like a dev URL:" >&2
  echo "      $(printf '%s' "$origin_line" | sed 's/^[[:space:]]*//')" >&2
  echo "      Expected a quoted https://<host> value." >&2
  exit 1
fi
if ! printf '%s' "$origin_line" | grep -qE 'APP_ORIGIN[[:space:]]*=[[:space:]]*"https://[^"]+"'; then
  echo "FAIL: APP_ORIGIN in [env.production.vars] must be a quoted https:// string." >&2
  exit 1
fi

# Signal 3: TURNSTILE_SITE_KEY is a non-empty quoted string.
sitekey_line=$(printf '%s\n' "$block" | grep -E '^[[:space:]]*TURNSTILE_SITE_KEY[[:space:]]*=' | head -1 || true)
if [ -z "$sitekey_line" ]; then
  echo "FAIL: TURNSTILE_SITE_KEY not declared under [env.production.vars]." >&2
  echo "      Symptom: login.astro renders data-sitekey={undefined}; Turnstile widget never mounts." >&2
  exit 1
fi
if ! printf '%s' "$sitekey_line" | grep -qE 'TURNSTILE_SITE_KEY[[:space:]]*=[[:space:]]*"[^"]+"'; then
  echo "FAIL: TURNSTILE_SITE_KEY in [env.production.vars] must be a non-empty quoted string." >&2
  exit 1
fi

# Signal 4: [[env.production.d1_databases]] restated.
if ! grep -qE '^\[\[env\.production\.d1_databases\]\][[:space:]]*$' "$FILE"; then
  echo "FAIL: [[env.production.d1_databases]] missing in $FILE." >&2
  echo "      Cloudflare bindings are non-inheritable. Overriding env.production.vars without restating the D1 binding leaves prod with no DB." >&2
  exit 1
fi

# Signal 5: [[env.production.r2_buckets]] restated.
if ! grep -qE '^\[\[env\.production\.r2_buckets\]\][[:space:]]*$' "$FILE"; then
  echo "FAIL: [[env.production.r2_buckets]] missing in $FILE." >&2
  echo "      Cloudflare bindings are non-inheritable. Same rule as D1 — must restate UPLOADS under env.production." >&2
  exit 1
fi

echo "OK: [env.production.*] configured — APP_ORIGIN https://, TURNSTILE_SITE_KEY set, D1 + R2 bindings restated."
