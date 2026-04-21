#!/usr/bin/env bash
# scripts/check-e2e-prereqs.sh
# Check preconditions required to actually run Playwright E2E tests locally.
# On missing prereq, prints the exact fix command. Exits non-zero on any FAIL.
#
# Background: on 2026-04-20 the CI a11y failure on PR #1 revealed that
# locally "E2E passed" was never verified — .dev.vars/D1/Playwright were
# not fully set up. This script makes that gap explicit and fixable.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

ok_count=0
warn_count=0
fail_count=0
declare -a fail_issues=()

print_ok()   { echo "  [OK]   $1";  ok_count=$((ok_count + 1)); }
print_warn() { echo "  [WARN] $1";  warn_count=$((warn_count + 1)); }
print_fail() { echo "  [FAIL] $1";  fail_count=$((fail_count + 1)); fail_issues+=("$1"); }

echo "=== E2E prerequisites check (run from $ROOT) ==="

# ---------- 1) .dev.vars ----------
echo
echo "1) .dev.vars"
if [ -f .dev.vars ]; then
  print_ok ".dev.vars exists"
  for key in APP_PASSWORD JWT_SECRET TURNSTILE_SECRET_KEY TURNSTILE_SITE_KEY; do
    if grep -q "^${key}=" .dev.vars; then
      print_ok ".dev.vars contains ${key}"
    else
      print_fail ".dev.vars missing ${key}"
    fi
  done
else
  print_fail ".dev.vars does not exist"
  cat <<'HINT'
         → create it (use Cloudflare Turnstile always-passes test keys):
           cat > .dev.vars <<'EOF'
           APP_PASSWORD=change-me-long-random
           JWT_SECRET=$(openssl rand -hex 32)
           TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
           TURNSTILE_SITE_KEY=1x00000000000000000000AA
           EOF
HINT
fi

# ---------- 2) Local D1 migrations ----------
echo
echo "2) Local D1 schema (migrations applied)"
d1_root=".wrangler/state/v3/d1"
if [ -d "$d1_root" ]; then
  print_ok "${d1_root} exists"
  d1_file="$(find "$d1_root" -name '*.sqlite' 2>/dev/null | head -n 1 || true)"
  if [ -n "${d1_file}" ]; then
    if command -v sqlite3 >/dev/null 2>&1; then
      tables="$(sqlite3 "$d1_file" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null || true)"
      if echo "$tables" | grep -q '^projects$'; then
        print_ok "projects table exists in local D1"
      else
        print_fail "projects table missing — run: npx wrangler d1 migrations apply DB --local"
      fi
      if echo "$tables" | grep -q '^uploads$'; then
        print_ok "uploads table exists in local D1"
      else
        print_fail "uploads table missing — run: npx wrangler d1 migrations apply DB --local"
      fi
    else
      print_warn "sqlite3 CLI not on PATH — cannot verify schema. If migrations were not applied, run: npx wrangler d1 migrations apply DB --local"
    fi
  else
    print_fail "no .sqlite file under ${d1_root} — run: npx wrangler d1 migrations apply DB --local"
  fi
else
  print_fail "${d1_root} missing — run: npx wrangler d1 migrations apply DB --local"
fi

# ---------- 3) Playwright chromium ----------
echo
echo "3) Playwright chromium"
if npx --no-install playwright --version >/dev/null 2>&1; then
  pw_version="$(npx --no-install playwright --version 2>/dev/null | head -n 1 || true)"
  print_ok "Playwright available (${pw_version})"
  install_out="$(npx --no-install playwright install --dry-run chromium 2>&1 || true)"
  if echo "$install_out" | grep -qiE 'already installed|is already|skipping'; then
    print_ok "Playwright chromium is installed"
  elif echo "$install_out" | grep -qiE 'browser:.*chromium|install location'; then
    # Newer playwright prints install location even when installed. Treat as OK if no "download" words.
    if echo "$install_out" | grep -qiE 'downloading|will be installed'; then
      print_fail "Playwright chromium not installed — run: npx playwright install --with-deps chromium"
    else
      print_ok "Playwright chromium appears installed"
    fi
  else
    print_warn "Could not decisively detect chromium install state. If E2E fails, run: npx playwright install --with-deps chromium"
  fi
else
  print_fail "Playwright not installed — run: npm ci && npx playwright install --with-deps chromium"
fi

# ---------- 4) E2E_APP_PASSWORD ----------
echo
echo "4) E2E_APP_PASSWORD env"
if [ -n "${E2E_APP_PASSWORD:-}" ]; then
  print_ok "E2E_APP_PASSWORD is exported"
  if [ -f .dev.vars ]; then
    dev_pw="$(grep '^APP_PASSWORD=' .dev.vars | head -n 1 | cut -d'=' -f2- || true)"
    if [ "$E2E_APP_PASSWORD" = "$dev_pw" ]; then
      print_ok "E2E_APP_PASSWORD matches APP_PASSWORD in .dev.vars"
    else
      print_fail "E2E_APP_PASSWORD does not match .dev.vars APP_PASSWORD — login step in E2E will fail"
    fi
  fi
else
  print_warn "E2E_APP_PASSWORD not exported — tests default to 'change-me-long-random'"
  echo "         → export matching value:"
  echo "           export E2E_APP_PASSWORD=\"\$(grep '^APP_PASSWORD=' .dev.vars | cut -d= -f2-)\""
fi

# ---------- 5) Turnstile test keys ----------
echo
echo "5) Turnstile test keys (local only)"
if [ -f .dev.vars ]; then
  if grep -q '^TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA' .dev.vars; then
    print_ok "Using Turnstile always-passes secret key — correct for local E2E"
  else
    print_warn "TURNSTILE_SECRET_KEY is not the always-passes test secret. E2E may fail verification."
    echo "         → see https://developers.cloudflare.com/turnstile/troubleshooting/testing/"
  fi
  if grep -q '^TURNSTILE_SITE_KEY=1x00000000000000000000AA' .dev.vars; then
    print_ok "Using Turnstile always-passes site key"
  else
    print_warn "TURNSTILE_SITE_KEY is not the always-passes test site key."
  fi
fi

# ---------- Summary ----------
echo
echo "=== Summary ==="
echo "  OK:   ${ok_count}"
echo "  WARN: ${warn_count}"
echo "  FAIL: ${fail_count}"

if [ "${fail_count}" -gt 0 ]; then
  echo
  echo "Prerequisites failed:"
  for issue in "${fail_issues[@]}"; do
    echo "  - ${issue}"
  done
  echo
  echo "Fix the above before running: npm run test:e2e"
  exit 1
fi

echo
echo "All prerequisites met. Next:"
echo "  npm run test:e2e -- tests/e2e/axe-smoke.spec.ts    # focused"
echo "  npm run test:e2e                                    # full 6 specs"
