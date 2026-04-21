# deploy-v0-wrangler-env-fix — production env vars via wrangler.toml

**Depends on:** `79a8a7b` (CSS fix) merged + production healthchecked.
**Does not touch:** `workers/cleanup.wrangler.toml`, application code, tests (except CI yml).
**Blast radius:** one config file + one verify script + CI wire.

---

## 1. Evidence

1. Cloudflare Pages dashboard rejects adding/editing plain env vars:
   > "Environment variables for this project are being managed through wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard."
2. Current `wrangler.toml` top-level block:
   ```toml
   [vars]
   APP_ORIGIN = "http://localhost:3000"
   ```
   - `TURNSTILE_SITE_KEY` absent.
3. Production runtime symptoms (to be confirmed by smoke, but consistent with #1+#2):
   - `env.APP_ORIGIN = "http://localhost:3000"` — CSRF middleware rejects legit same-origin POSTs from `https://eia-workbench-v0.pages.dev`.
   - `env.TURNSTILE_SITE_KEY = undefined` — login page renders `<div class="cf-turnstile" data-sitekey={undefined}>`, widget never mounts.
4. Single cause for both: Phase 4.A (dashboard plain vars) was a no-op because the dashboard was locked once `[vars]` appeared in `wrangler.toml`. The Phase 4.A commit preceded that lockout assumption check.

## 2. Root cause

`wrangler.toml` is the sole source of truth for plain env vars when present.

Top-level `[vars]` applies to:
- `wrangler pages dev` local (overridable by `.dev.vars`)
- preview branch deploys
- production branch deploys **iff** no `[env.production.vars]` block exists

Top-level `[vars]` in our repo holds dev-only `http://localhost:3000`, and that value rode straight into production.

## 3. Rejected hypotheses

- **A. Dashboard input hadn't saved yet.** Rejected — dashboard returned a blocking message; the form never accepted input.
- **B. Phase 4.A secret-put was miswired.** Rejected — the three items affected are plain vars, not secrets. Secret flow (`APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`) is orthogonal and verified working via `wrangler pages secret list`.
- **C. Cache / propagation delay.** Rejected — the `Variables and Secrets` panel is SSR-rendered server-side state, not cached CDN content.

## 4. Verification via Cloudflare docs

Read 2026-04-22 from `developers.cloudflare.com/pages/functions/wrangler-configuration/` and `/workers/wrangler/configuration/`:

> "This file becomes the source of truth when used, meaning that you can not edit the same fields in the dashboard once you are using this file."

> "Non-inheritable keys are configurable at the top-level, but, if any one non-inheritable key is overridden for any environment (for example, `[[env.production.kv_namespaces]]`), all non-inheritable keys must also be specified in the environment configuration and overridden."

> "For the following commands, if you are using git it is important to remember the branch that you set as your production branch... `npx wrangler pages deploy --branch <PRODUCTION BRANCH>`."

**Non-inheritable per Cloudflare:** `vars`, `d1_databases`, `r2_buckets`, `kv_namespaces`, `services`, `queues`, `durable_objects`, `ai`, `analytics_engine_datasets`.

**Implication for us:** switching to `[env.production.vars]` forces a re-declaration of `[[env.production.d1_databases]]` and `[[env.production.r2_buckets]]` with identical values. Harmless duplication, but the validator rejects the config otherwise.

## 5. Fix strategy

Minimal diff. One file, `wrangler.toml`:

```toml
name = "eia-workbench"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"

# ── Top-level: applied to local dev and preview branch deploys ──
[[d1_databases]]
binding = "DB"
database_name = "eia-workbench-v0"
database_id = "afca9a24-7725-4530-8c49-e3d001bd24d8"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "eia-workbench-v0-uploads"

[vars]
APP_ORIGIN = "http://localhost:3000"
TURNSTILE_SITE_KEY = "1x00000000000000000000AA"  # Cloudflare always-pass test key

# ── Production environment: wrangler pages deploy --branch=main ──
# Non-inheritable: D1 + R2 must be restated. Same values as top-level.
[[env.production.d1_databases]]
binding = "DB"
database_name = "eia-workbench-v0"
database_id = "afca9a24-7725-4530-8c49-e3d001bd24d8"
migrations_dir = "migrations"

[[env.production.r2_buckets]]
binding = "UPLOADS"
bucket_name = "eia-workbench-v0-uploads"

[env.production.vars]
APP_ORIGIN = "https://eia-workbench-v0.pages.dev"
TURNSTILE_SITE_KEY = "0x4AAAAAADAUrmpBcDS4csj4"
```

### What does NOT change
- `workers/cleanup.wrangler.toml` — cleanup worker has zero vars, only `DB` + `UPLOADS` bindings. Unchanged.
- Application code, tests, layouts, CSS, middleware — all unchanged.
- Secrets (`APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`) — Cloudflare-side only, untouched. Secrets are orthogonal to `[vars]` and survive this change.

### Values appearing in source control
- `1x00000000000000000000AA` — Cloudflare's documented public always-pass Turnstile site key. Already in `.github/workflows/ci.yml`. Not a secret.
- `0x4AAAAAADAUrmpBcDS4csj4` — production Turnstile site key. Client-exposed (rendered in HTML). Not a secret. Identical exposure to what prod HTML was supposed to show.

## 6. File structure

- Modify: `wrangler.toml` (+17 lines)
- Create: `scripts/check-wrangler-prod-vars.sh` (~40 lines)
- Modify: `.github/workflows/ci.yml` (+2 lines — verify step after build)
- Create: this plan document

No code files touched. No migrations. No new dependencies.

## 7. Tasks

### T1 (Claude) — scripts/check-wrangler-prod-vars.sh

Write a verify script that asserts, in `wrangler.toml`:

1. Block `[env.production.vars]` exists.
2. Inside that block: `APP_ORIGIN` starts with `https://` and does NOT contain `localhost`.
3. Inside that block: `TURNSTILE_SITE_KEY` is set to a non-empty quoted string.
4. `[[env.production.d1_databases]]` exists.
5. `[[env.production.r2_buckets]]` exists.

Fail-fast on any missing signal with a specific diagnostic message. Mirror the 2-signal-AND pattern of `check-build-css.sh`.

Run against current `wrangler.toml` → MUST FAIL (baseline capture).

### T2 (Claude) — update wrangler.toml

Apply the diff from §5. Verify:

- `bash scripts/check-wrangler-prod-vars.sh` → OK
- `npx wrangler --version` still works (no config parse error)
- `npm run build` still green (build does not consult `[env.production.*]`)

### T3 (Claude) — wire CI

Add step in `.github/workflows/ci.yml` after the existing `verify CSS bundle` step:

```yaml
      - name: verify production env vars
        run: bash scripts/check-wrangler-prod-vars.sh
```

### T4 (Claude) — full local verify

Run in sequence, all must be green:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `bash scripts/assertion-grep.sh`
- `rm -rf dist && npm run build`
- `bash scripts/check-build-css.sh`
- `bash scripts/check-wrangler-prod-vars.sh`

### T5 (Claude) — commit preview

Stage the 3 files (wrangler.toml, check-wrangler-prod-vars.sh, ci.yml) + this plan.
Conventional commit: `fix(deploy): wire production env vars via [env.production.vars]`.
Body: summarize root cause (dashboard lockout + top-level [vars] leak), what changed, and the verification evidence (docs quotes + local check outputs).
Show `git show --stat HEAD` to user. Do NOT push.

### T6 (USER) — push + redeploy + verify

```bash
git push origin main
# wait for CI green (includes new verify step)
rm -rf dist node_modules/.astro && npm ci && npm run build
npx wrangler pages deploy dist \
  --project-name=eia-workbench-v0 \
  --branch=main \
  --commit-dirty=true
```

Verify:
```bash
# 1. Login page renders Turnstile widget
curl -s https://eia-workbench-v0.pages.dev/login | grep 'cf-turnstile'
# → expect: <div class="cf-turnstile" data-sitekey="0x4AAAAAADAUrmpBcDS4csj4" ...>

# 2. Browser check
# - Navigate to /login in Chrome
# - DevTools console: no "invalid sitekey" error
# - Network: challenge.cloudflareinsights (not strictly required), turnstile iframe loaded
# - Type password, solve challenge, submit → expect 302 to /
# - No 403 from CSRF middleware
```

Report back:
- New deploy URL (`https://<hash>.eia-workbench-v0.pages.dev`)
- curl grep output
- Login success/failure
- Any console errors

## 8. Self-review

- [x] Does the plan introduce new secrets to source control? No — both TURNSTILE keys are public (always-pass test key + client-facing production site key).
- [x] Does it break local dev? No — top-level `[vars]` still has `http://localhost:3000`; `.dev.vars` still overrides.
- [x] Does it break CI E2E? No — CI's `.dev.vars` provides all needed values including `TURNSTILE_SITE_KEY`; top-level `[vars].APP_ORIGIN` remains localhost.
- [x] Does it break preview branch deploys? Preview branches fall back to top-level `[vars]` which is localhost — preview CSRF WILL be broken. BUT: we don't deploy previews in v0. Logged as follow-up.
- [x] Does it require re-running D1 migrations on prod? No — bindings point to the same `database_id` as before.
- [x] Does `--branch=main` map to `[env.production.*]`? Yes per Cloudflare docs, iff project's production branch is "main" (it is — verified in dashboard during Phase 1.3).
- [x] Are values in the diff traceable? APP_ORIGIN from user's Phase 4.1 spec; TURNSTILE_SITE_KEY from user's Phase 4.2 spec.
- [x] Does `workers/cleanup.wrangler.toml` need the same treatment? No — `cron-cleanup.ts` reads only `DB`+`UPLOADS`, no env vars. Deployment CLI is `wrangler deploy` (Workers), not `wrangler pages deploy`. Different env model; defer until we add vars to cleanup.
- [x] Does the CSS fix plan's verify step still run in CI? Yes — `check-build-css.sh` remains, `check-wrangler-prod-vars.sh` is a new adjacent step. Both must pass.

## 9. Follow-up issues (register after this ships + Phase 8)

1. **Preview branch APP_ORIGIN mismatch**. When we enable Git-integrated preview deploys, `[vars].APP_ORIGIN = "http://localhost:3000"` will break CSRF on `https://<preview-hash>.eia-workbench-v0.pages.dev`. Options: (a) `[env.preview.vars]` with a regex-matchable wildcard (not supported) — infeasible; (b) middleware accepts any `*.eia-workbench-v0.pages.dev` origin — middleware change; (c) disable preview deploys via project setting. Recommend (c) for v0, (b) for v1.
2. **`workers/cleanup.wrangler.toml` does not yet have `[env.production.*]`**. If we later add env vars to cleanup (e.g., `ALERT_WEBHOOK`), the same pattern applies. Register as a docstring in that file + CLAUDE.md §9 note.
3. **No TOML schema check in CI**. `check-wrangler-prod-vars.sh` is grep-based and brittle against reformatting. Consider `wrangler types` or a TOML parser lint step in v1.
4. **Plan §3.3 fixups (from deploy-v0.md)**. Previously noted — include in Phase 8 fixup commit: `_cf_KV` is a legitimate D1 internal table (plan wrongly flagged it as unexpected); `--commit-dirty=true` flag mention.

---

**Approval gate.** Waiting for user sign-off before executing T1.
