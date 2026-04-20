# feature/project-shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first eia-workbench feature — a single-password-gated shell where an EIA practitioner can create/list/soft-delete "project" records (scoped to onshore wind) and upload/validate/delete PDF/DOCX/TXT files under strict v0 quotas, with a 30-day recently-deleted drawer and a Cloudflare Cron worker for hard deletion.

**Architecture:** Astro 5 + React islands on Cloudflare Pages/Workers. Server routes write to D1 and stream uploads through the Worker to R2 (no presigned URLs in v0). Session is an HS256 JWT cookie with a rotating `JWT_SECRET` as the kill switch. All state-changing endpoints pass Zod → session → Origin → handler; all HTML responses carry CSP + security headers. A second Worker runs nightly to hard-delete soft-deleted rows older than 30 days, guarded by a 1000-row ceiling.

**Tech Stack:** Astro 5, React 18, TypeScript strict, Tailwind CSS, Zod, nanoid, Pretendard, Lucide icons, Vitest, Playwright, axe-core, Wrangler, Miniflare (for local D1/R2), Cloudflare D1/R2/Turnstile/Cron.

---

## File Structure Map

### Configuration & scaffolding
- `package.json` — dependencies, scripts (`dev`, `typecheck`, `lint`, `format`, `test`, `test:e2e`, `build`)
- `tsconfig.json` — strict, path aliases (`@/*` → `src/*`)
- `astro.config.mjs` — Cloudflare adapter, Tailwind, React integration
- `tailwind.config.ts` — DESIGN.md color tokens + typography
- `wrangler.toml` — D1 binding `DB`, R2 binding `UPLOADS`, Cron trigger, env vars
- `.dev.vars.example` — documented secret placeholders
- `playwright.config.ts` — e2e runner config (baseURL localhost)
- `vitest.config.ts` — unit runner config

### Database
- `migrations/0001_init.sql` — all 3 tables + indexes
- `migrations/README.md` — how to run

### Library code (`src/lib/`)
- `src/lib/constants.ts` — `MAX_FILE_BYTES`, `MAX_PROJECT_BYTES`, `MAX_PROJECT_FILES`, `ALLOWED_MIME`
- `src/lib/schemas.ts` — Zod schemas: `projectCreateSchema`, `uploadMetaSchema`, `loginSchema`
- `src/lib/id.ts` — nanoid wrappers (`newProjectId`, `newUploadId`, `newR2Suffix`, `newJti`)
- `src/lib/logger.ts` — PII-safe logger (level, route, method, status, latency, jti-hash-8, error name/message)
- `src/lib/lint-copy.ts` — forbidden-assertion regex + `detectLegalAssertion(text): string[]`
- `src/lib/auth/password.ts` — `timingSafeEqual(a, b)` via Web Crypto
- `src/lib/auth/jwt.ts` — `signJwt(payload, secret)`, `verifyJwt(token, secret)` HS256
- `src/lib/auth/session.ts` — cookie build/parse helpers, `Max-Age=604800`
- `src/lib/auth/rate-limit.ts` — `recordAttempt(db, ip, ok)`, `isBlocked(db, ip)` using `login_attempts`
- `src/lib/upload/magic-bytes.ts` — `validateMagicBytes(buf, mime)` for PDF/DOCX/TXT
- `src/lib/upload/r2-key.ts` — `buildR2Key(projectId)` returns `projects/<pid>/<nanoid16>`
- `src/lib/kostat/index.ts` — `loadRegions()`, `isValidRegionCode(code)`, `labelFor(code)`
- `src/data/administrative-divisions.json` — KOSTAT region dataset (bootstrapped from kosis.kr public list)

### Middleware
- `src/middleware.ts` — Astro global middleware: session check, Origin check for mutating verbs, security headers on HTML

### Components (Astro server + React islands)
- `src/layouts/AppLayout.astro` — shell with banner, nav, outlet
- `src/components/PilotWarningBanner.astro` — yellow pilot-mode banner
- `src/components/NewProjectModal.tsx` — React island (form + Zod + fetch)
- `src/components/UploadDropzone.tsx` — React island (drag/drop, progress, error toast)
- `src/components/FileList.tsx` — React island (delete, error handling)
- `src/components/RecentlyDeletedDrawer.tsx` — React island
- `src/components/Toast.tsx` + `src/components/toast-store.ts` — nanostores toast channel
- `src/components/DisabledTab.tsx` — React island with tooltip

### Pages & API
- `src/pages/login.astro` — GET form + POST handler (Turnstile verify, rate limit, set cookie)
- `src/pages/logout.ts` — POST handler
- `src/pages/index.astro` — project list + search + banner
- `src/pages/projects/[id].astro` — project detail
- `src/pages/api/projects/index.ts` — `POST` create, `GET` list
- `src/pages/api/projects/[id]/index.ts` — `GET` one, `DELETE` soft-delete
- `src/pages/api/projects/[id]/restore.ts` — `PATCH`
- `src/pages/api/projects/[id]/uploads/index.ts` — `POST` upload, `GET` list
- `src/pages/api/projects/[id]/uploads/[uploadId]/index.ts` — `DELETE`
- `src/pages/api/projects/[id]/uploads/[uploadId]/restore.ts` — `PATCH`

### Workers
- `workers/cron-cleanup.ts` — scheduled handler, 30-day hard delete, guarded

### Tests
- `tests/unit/lint-copy.test.ts`
- `tests/unit/schemas.test.ts`
- `tests/unit/magic-bytes.test.ts`
- `tests/unit/r2-key.test.ts`
- `tests/unit/jwt.test.ts`
- `tests/unit/password.test.ts`
- `tests/unit/rate-limit.test.ts`
- `tests/unit/kostat.test.ts`
- `tests/unit/logger.test.ts`
- `tests/unit/cron-cleanup.test.ts`
- `tests/e2e/crud-happy.spec.ts`
- `tests/e2e/hwp-reject.spec.ts`
- `tests/e2e/quota-exceeded.spec.ts`

### CI
- `scripts/assertion-grep.sh` — grep for DESIGN.md §7 regex in all UI strings
- `.github/workflows/ci.yml` — typecheck → lint → test → assertion-grep → build

---

## Task Overview

1. Astro + Tailwind + TS strict scaffold
2. Cloudflare config (wrangler.toml, bindings, Miniflare)
3. D1 migration 0001_init.sql + runner script
4. Constants + id utilities
5. Zod schemas
6. PII-safe logger
7. Legal-assertion lint utility (`lint-copy.ts`)
8. Password timing-safe compare
9. HS256 JWT (sign/verify via Web Crypto)
10. Session cookie helpers + login rate-limit
11. Astro middleware (session + Origin + security headers)
12. `/login` page + `/logout` handler (with Turnstile)
13. KOSTAT regions + lookup utility
14. `POST/GET /api/projects` (create + list)
15. `GET/DELETE /api/projects/[id]` + `PATCH .../restore`
16. Magic bytes + R2 key utilities
17. `POST /api/projects/[id]/uploads` (full pipeline)
18. `DELETE /api/projects/[id]/uploads/[uploadId]` + restore
19. `AppLayout` + `PilotWarningBanner` + toast store
20. `/` project list page (search + empty state)
21. `NewProjectModal` (React island)
22. `/projects/[id]` detail page (tabs, banner, disabled-tab tooltip)
23. `UploadDropzone` + `FileList` (React islands)
24. `RecentlyDeletedDrawer` (React island)
25. Cron worker 30-day hard delete
26. E2E: CRUD happy path
27. E2E: HWP rejection + quota exceeded
28. Assertion-grep + axe lint + CI workflow

---

## Task 1: Astro + Tailwind + TS strict scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `tailwind.config.ts`, `postcss.config.cjs`, `src/env.d.ts`, `src/styles/global.css`, `.prettierrc.json`, `.eslintrc.cjs`, `.gitignore` (append)
- Create: `src/pages/_placeholder.astro` (temporary so `npm run build` passes until T20)

**Context:** The repo already has `CLAUDE.md`, `DESIGN.md`, `progress.md`, `.gitignore`. Do NOT run the interactive `npm create astro@latest` — we author files directly so every choice is reproducible.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "eia-workbench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18.17.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler pages dev ./dist --d1=DB --r2=UPLOADS --compatibility-date=2024-09-23 --compatibility-flag=nodejs_compat",
    "typecheck": "astro check && tsc --noEmit",
    "lint": "eslint 'src/**/*.{ts,tsx,astro}' && prettier --check 'src/**/*.{ts,tsx,astro,md}'",
    "format": "prettier --write 'src/**/*.{ts,tsx,astro,md}'",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "assertion-grep": "bash scripts/assertion-grep.sh"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/tailwind": "^5.1.0",
    "astro": "^5.0.0",
    "lucide-react": "^0.460.0",
    "nanoid": "^5.0.0",
    "nanostores": "^0.11.0",
    "@nanostores/react": "^0.7.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241022.0",
    "@playwright/test": "^1.48.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "axe-playwright": "^2.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-astro": "^1.3.0",
    "eslint-plugin-react": "^7.37.0",
    "miniflare": "^3.20241022.0",
    "prettier": "^3.3.0",
    "prettier-plugin-astro": "^0.14.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.80.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strictest",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "jsx": "react-jsx",
    "types": ["@cloudflare/workers-types", "astro/client"],
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*", "workers/**/*", "tests/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  security: { checkOrigin: false }, // our middleware handles it explicitly
  server: { port: 3000 }
});
```

- [ ] **Step 4: Write `tailwind.config.ts`** (DESIGN.md §2 tokens)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        border: 'var(--c-border)',
        primary: { DEFAULT: 'var(--c-primary)', hover: 'var(--c-primary-hover)' },
        warning: { DEFAULT: 'var(--c-warning)', bg: 'var(--c-warning-bg)' },
        danger: { DEFAULT: 'var(--c-error)', bg: 'var(--c-error-bg)' },
        text: {
          primary: 'var(--c-text-primary)',
          secondary: 'var(--c-text-secondary)',
          tertiary: 'var(--c-text-tertiary)'
        }
      },
      fontFamily: {
        sans: ['Pretendard Variable', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      fontSize: {
        display: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h1: ['22px', { lineHeight: '30px', fontWeight: '600' }],
        h2: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '24px' }],
        small: ['13px', { lineHeight: '20px' }]
      },
      spacing: { '0.5': '2px', '18': '72px' },
      maxWidth: { content: '1200px' }
    }
  },
  plugins: []
} satisfies Config;
```

- [ ] **Step 5: Write `postcss.config.cjs`**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Write `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --c-bg: #FAFAF8;
  --c-surface: #FFFFFF;
  --c-border: #E5E5E1;
  --c-text-primary: #18181B;
  --c-text-secondary: #52525B;
  --c-text-tertiary: #71717A;
  --c-primary: #1F6FEB;
  --c-primary-hover: #1456C5;
  --c-warning: #B45309;
  --c-warning-bg: #FEF3C7;
  --c-error: #B91C1C;
  --c-error-bg: #FEE2E2;
  --c-focus-ring: #1F6FEB;
}

html, body { background: var(--c-bg); color: var(--c-text-primary); }
body { font-family: theme('fontFamily.sans'); }
*:focus-visible { outline: 2px solid var(--c-focus-ring); outline-offset: 2px; }
```

- [ ] **Step 7: Write `src/env.d.ts`**

```ts
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_PASSWORD: string;
  JWT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  APP_ORIGIN: string;
}

declare namespace App {
  interface Locals extends Runtime {
    session?: { jti: string };
  }
}
```

- [ ] **Step 8: Write `src/pages/_placeholder.astro`**

```astro
---
// Placeholder so astro build succeeds before pages are written.
---
<p>eia-workbench scaffolding — replaced in T20.</p>
```

- [ ] **Step 9: Write `.prettierrc.json`, `.eslintrc.cjs`**

`.prettierrc.json`:
```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  "overrides": [{ "files": "*.astro", "options": { "parser": "astro" } }]
}
```

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:astro/recommended'],
  overrides: [{ files: ['*.astro'], parser: 'astro-eslint-parser' }],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error'
  }
};
```

- [ ] **Step 10: Append to `.gitignore`**

```
node_modules/
dist/
.astro/
.wrangler/
.dev.vars
.env
playwright-report/
test-results/
coverage/
```

- [ ] **Step 11: Install and verify**

Run:
```bash
npm install
npm run typecheck
npm run build
```
Expected: `typecheck` passes (0 errors), `build` emits a `dist/` with the placeholder page.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs tailwind.config.ts postcss.config.cjs src/ .prettierrc.json .eslintrc.cjs .gitignore
git commit -m "feat(scaffold): astro 5 + react + tailwind + ts-strict + cf adapter"
```

---

## Task 2: Cloudflare config + D1/R2 bindings + Miniflare dev

**Files:**
- Create: `wrangler.toml`, `.dev.vars.example`
- Modify: `.gitignore` (ensure `.dev.vars` present — confirmed in T1)

- [ ] **Step 1: Write `wrangler.toml`**

```toml
name = "eia-workbench"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "eia-workbench-dev"
database_id = "local-placeholder"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "eia-workbench-uploads-dev"

[vars]
APP_ORIGIN = "http://localhost:3000"

[triggers]
crons = ["0 18 * * *"]  # daily 03:00 KST (UTC 18:00 prev day)
```

- [ ] **Step 2: Write `.dev.vars.example`**

```
# Copy to .dev.vars (gitignored) for local dev. Production uses `wrangler secret put`.
APP_PASSWORD=change-me-long-random
JWT_SECRET=change-me-min-32-chars-random-hex
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA   # Cloudflare test key (always passes)
TURNSTILE_SITE_KEY=1x00000000000000000000AA                 # Cloudflare test key
```

- [ ] **Step 3: Verify wrangler loads the config**

Run:
```bash
npx wrangler --version
cp .dev.vars.example .dev.vars
```
Expected: wrangler version printed; `.dev.vars` exists locally and is gitignored.

- [ ] **Step 4: Commit**

```bash
git add wrangler.toml .dev.vars.example
git commit -m "feat(cf): wrangler config with d1/r2 bindings and cron trigger"
```

---

## Task 3: D1 migration + migrations runner

**Files:**
- Create: `migrations/0001_init.sql`, `migrations/README.md`

- [ ] **Step 1: Write the failing test** — `tests/unit/migration-shape.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migration 0001_init.sql', () => {
  const sql = readFileSync(resolve('migrations/0001_init.sql'), 'utf8');

  it('creates projects, uploads, login_attempts tables', () => {
    expect(sql).toMatch(/CREATE TABLE projects/);
    expect(sql).toMatch(/CREATE TABLE uploads/);
    expect(sql).toMatch(/CREATE TABLE login_attempts/);
  });

  it('constrains industry to onshore_wind', () => {
    expect(sql).toMatch(/CHECK\(industry\s+IN\s*\(\s*'onshore_wind'\s*\)\)/);
  });

  it('declares owner_id on projects (v1 placeholder)', () => {
    expect(sql).toMatch(/owner_id\s+TEXT/);
  });

  it('declares sha256 column and partial unique index', () => {
    expect(sql).toMatch(/sha256\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/uploads_project_sha_alive[\s\S]+WHERE\s+deleted_at\s+IS\s+NULL/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/migration-shape.test.ts`
Expected: ENOENT (file not found).

- [ ] **Step 3: Write `migrations/0001_init.sql`**

```sql
-- 0001_init.sql — project-shell v0

CREATE TABLE projects (
  id                    TEXT PRIMARY KEY,
  owner_id              TEXT,
  name                  TEXT NOT NULL,
  industry              TEXT NOT NULL CHECK(industry IN ('onshore_wind')),
  site_region_code      TEXT,
  site_region           TEXT,
  site_sub_region_code  TEXT,
  site_sub_region       TEXT,
  capacity_mw           REAL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);
CREATE INDEX projects_created_at ON projects(created_at);
CREATE INDEX projects_deleted_at ON projects(deleted_at);

CREATE TABLE uploads (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  r2_key          TEXT NOT NULL,
  sha256          TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime            TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX uploads_project_id ON uploads(project_id);
CREATE INDEX uploads_deleted_at ON uploads(deleted_at);
CREATE UNIQUE INDEX uploads_project_sha_alive
  ON uploads(project_id, sha256) WHERE deleted_at IS NULL;

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  ok INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_ts ON login_attempts(ip, ts);
```

- [ ] **Step 4: Write `migrations/README.md`**

```markdown
# D1 migrations

Local:
```bash
npm run db:migrate:local
```

Production (first time):
```bash
npx wrangler d1 create eia-workbench
# copy database_id into wrangler.toml
npx wrangler d1 migrations apply DB --remote
```
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/migration-shape.test.ts`
Expected: 4 passing.

- [ ] **Step 6: Apply locally**

Run: `npm run db:migrate:local`
Expected: "Migrations applied: 1".

- [ ] **Step 7: Commit**

```bash
git add migrations/ tests/unit/migration-shape.test.ts
git commit -m "feat(db): initial schema with projects, uploads, login_attempts"
```

---

## Task 4: Constants + id utilities

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/id.ts`, `tests/unit/id.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/unit/id.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { newProjectId, newUploadId, newR2Suffix, newJti } from '@/lib/id';

describe('id utilities', () => {
  it('projectId is 12 chars URL-safe', () => {
    const id = newProjectId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
  it('uploadId is 12 chars URL-safe', () => {
    expect(newUploadId()).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
  it('r2 suffix is 16 chars URL-safe', () => {
    expect(newR2Suffix()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
  it('jti is 21 chars URL-safe', () => {
    expect(newJti()).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
  it('ids are unique across 1000 calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newProjectId()));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test — fail (module missing)**

Run: `npm test -- tests/unit/id.test.ts`
Expected: FAIL ("Cannot find module '@/lib/id'").

- [ ] **Step 3: Write `src/lib/constants.ts`**

```ts
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 300 * 1024 * 1024;
export const MAX_PROJECT_FILES = 30;

export const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const SOFT_DELETE_RETENTION_DAYS = 30;
export const CRON_HARD_DELETE_ROW_CEILING = 1000;

export const LOGIN_FAIL_WINDOW_MINUTES = 10;
export const LOGIN_FAIL_MAX = 5;
export const LOGIN_MIN_RESPONSE_MS = 300;

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
```

- [ ] **Step 4: Write `src/lib/id.ts`**

```ts
import { customAlphabet } from 'nanoid';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export const newProjectId = customAlphabet(ALPHABET, 12);
export const newUploadId = customAlphabet(ALPHABET, 12);
export const newR2Suffix = customAlphabet(ALPHABET, 16);
export const newJti = customAlphabet(ALPHABET, 21);
```

- [ ] **Step 5: Run test — pass**

Run: `npm test -- tests/unit/id.test.ts`
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/id.ts tests/unit/id.test.ts
git commit -m "feat(lib): constants and nanoid id helpers"
```

---

## Task 5: Zod schemas

**Files:**
- Create: `src/lib/schemas.ts`, `tests/unit/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { projectCreateSchema, loginSchema, uploadMetaSchema } from '@/lib/schemas';

describe('projectCreateSchema', () => {
  it('accepts a minimal valid input', () => {
    const r = projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind' });
    expect(r.success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(projectCreateSchema.safeParse({ name: '', industry: 'onshore_wind' }).success).toBe(false);
  });
  it('rejects name > 200 chars', () => {
    const r = projectCreateSchema.safeParse({ name: 'x'.repeat(201), industry: 'onshore_wind' });
    expect(r.success).toBe(false);
  });
  it('rejects industry other than onshore_wind', () => {
    const r = projectCreateSchema.safeParse({ name: 'A', industry: 'solar' });
    expect(r.success).toBe(false);
  });
  it('rejects capacity_mw out of range', () => {
    expect(projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind', capacity_mw: -1 }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: 'A', industry: 'onshore_wind', capacity_mw: 10001 }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires password and turnstileToken', () => {
    expect(loginSchema.safeParse({ password: 'p', turnstileToken: 't' }).success).toBe(true);
    expect(loginSchema.safeParse({ password: 'p' }).success).toBe(false);
  });
});

describe('uploadMetaSchema', () => {
  it('accepts allowed mime', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.pdf',
      mime: 'application/pdf',
      size_bytes: 1024
    });
    expect(r.success).toBe(true);
  });
  it('rejects HWP mime', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.hwp',
      mime: 'application/x-hwp',
      size_bytes: 1024
    });
    expect(r.success).toBe(false);
  });
  it('rejects size over MAX_FILE_BYTES', () => {
    const r = uploadMetaSchema.safeParse({
      original_name: 'x.pdf',
      mime: 'application/pdf',
      size_bytes: 31 * 1024 * 1024
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — fail**

Run: `npm test -- tests/unit/schemas.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/lib/schemas.ts`**

```ts
import { z } from 'zod';
import { ALLOWED_MIME, MAX_FILE_BYTES } from './constants';

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.literal('onshore_wind'),
  site_region_code: z.string().max(10).optional(),
  site_region: z.string().max(50).optional(),
  site_sub_region_code: z.string().max(10).optional(),
  site_sub_region: z.string().max(50).optional(),
  capacity_mw: z.number().min(0).max(10000).optional()
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const loginSchema = z.object({
  password: z.string().min(1).max(512),
  turnstileToken: z.string().min(1)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const uploadMetaSchema = z.object({
  original_name: z.string().min(1).max(300),
  mime: z.enum(ALLOWED_MIME),
  size_bytes: z.number().int().positive().max(MAX_FILE_BYTES)
});
export type UploadMetaInput = z.infer<typeof uploadMetaSchema>;
```

- [ ] **Step 4: Run test — pass**

Run: `npm test -- tests/unit/schemas.test.ts`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/unit/schemas.test.ts
git commit -m "feat(lib): zod schemas for project create, login, upload meta"
```

---

## Task 6: PII-safe logger

**Files:**
- Create: `src/lib/logger.ts`, `tests/unit/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('emits level, route, method, status, latency, jtiHash8', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/api/projects', method: 'POST', status: 201, latencyMs: 42, jti: 'abcdefghij1234567890x' });
    expect(sink).toHaveBeenCalledOnce();
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e.level).toBe('info');
    expect(e.route).toBe('/api/projects');
    expect(e.method).toBe('POST');
    expect(e.status).toBe(201);
    expect(e.latencyMs).toBe(42);
    expect((e.jtiHash8 as string).length).toBe(8);
  });

  it('never logs req body, filenames, or project names', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/api/x', method: 'POST', status: 200, latencyMs: 1, jti: 'abcdefghij1234567890x',
      // @ts-expect-error — these keys must be ignored
      body: 'secret', filename: 'eia-plan.pdf', projectName: '강원풍력',
    });
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e).not.toHaveProperty('body');
    expect(e).not.toHaveProperty('filename');
    expect(e).not.toHaveProperty('projectName');
  });

  it('masks IP to /24', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/x', method: 'GET', status: 200, latencyMs: 1, jti: 'abcdefghij1234567890x', ip: '203.0.113.77' });
    expect((sink.mock.calls[0]![0] as Record<string, unknown>).ip).toBe('203.0.113.0/24');
  });

  it('error entries include error name and message only', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    const err = new Error('boom'); err.stack = 'STACK-DETAIL';
    log.error({ route: '/x', method: 'GET', status: 500, latencyMs: 1, jti: 'abcdefghij1234567890x', error: err });
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e.errorName).toBe('Error');
    expect(e.errorMessage).toBe('boom');
    expect(JSON.stringify(e)).not.toContain('STACK-DETAIL');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/logger.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/lib/logger.ts`**

```ts
type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogInput {
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  jti: string;
  ip?: string;
  error?: Error;
  // Any other key is silently dropped.
  [_: string]: unknown;
}

interface LogEntry {
  level: Level;
  ts: string;
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  jtiHash8: string;
  ip?: string;
  errorName?: string;
  errorMessage?: string;
}

function maskIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.0/24`;
  // IPv6 or unknown — drop.
  return undefined;
}

function hash8(jti: string): string {
  // FNV-1a 32-bit → hex → slice 8
  let h = 0x811c9dc5;
  for (let i = 0; i < jti.length; i++) {
    h ^= jti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

function build(level: Level, i: LogInput): LogEntry {
  return {
    level,
    ts: new Date().toISOString(),
    route: i.route,
    method: i.method,
    status: i.status,
    latencyMs: i.latencyMs,
    jtiHash8: hash8(i.jti),
    ip: maskIp(i.ip),
    errorName: i.error?.name,
    errorMessage: i.error?.message
  };
}

export interface Logger {
  debug(i: LogInput): void;
  info(i: LogInput): void;
  warn(i: LogInput): void;
  error(i: LogInput): void;
}

export function createLogger(opts: { sink?: (e: LogEntry) => void } = {}): Logger {
  const sink = opts.sink ?? ((e) => console.log(JSON.stringify(e)));
  return {
    debug: (i) => sink(build('debug', i)),
    info: (i) => sink(build('info', i)),
    warn: (i) => sink(build('warn', i)),
    error: (i) => sink(build('error', i))
  };
}

export const logger = createLogger();
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/logger.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logger.ts tests/unit/logger.test.ts
git commit -m "feat(lib): pii-safe logger with ip masking and jti hashing"
```

---

## Task 7: Legal-assertion lint utility

**Files:**
- Create: `src/lib/lint-copy.ts`, `tests/unit/lint-copy.test.ts`

Per DESIGN.md §7. Consumed at build/test time via `assertion-grep.sh` and at runtime by `ResultCard` (later feature) to block forbidden UI strings.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { detectLegalAssertion, FORBIDDEN_ASSERTION_REGEX } from '@/lib/lint-copy';

describe('detectLegalAssertion', () => {
  it.each([
    '이 사업은 환경영향평가 대상입니다',
    '협의 통과 완료',
    '승인됨 - 검토 안전',
    '법적으로 문제 없음',
    'AI가 현황조사를 자동 완료하여 안전합니다'
  ])('flags forbidden: %s', (s) => {
    expect(detectLegalAssertion(s).length).toBeGreaterThan(0);
  });

  it.each([
    '대상 가능성이 있어 전문가 확인이 필요합니다',
    '보완 리스크를 낮추는 체크 항목입니다',
    '문헌·입력자료 기준 검토이며 현지조사는 별도 필요합니다'
  ])('passes safe phrasing: %s', (s) => {
    expect(detectLegalAssertion(s)).toEqual([]);
  });

  it('exposes the regex for shell grep', () => {
    expect(FORBIDDEN_ASSERTION_REGEX.source.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/lint-copy.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/lib/lint-copy.ts`**

```ts
export const FORBIDDEN_ASSERTION_REGEX =
  /(환경영향평가\s*대상입니다|협의\s*통과|승인됨|법적으로\s*문제\s*없|자동.*(완료|작성).*(안전|문제없))/g;

export function detectLegalAssertion(text: string): string[] {
  const hits: string[] = [];
  for (const match of text.matchAll(FORBIDDEN_ASSERTION_REGEX)) {
    hits.push(match[0]);
  }
  return hits;
}
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/lint-copy.test.ts`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lint-copy.ts tests/unit/lint-copy.test.ts
git commit -m "feat(lib): legal-assertion detector matching DESIGN.md §7"
```

---

## Task 8: Password timing-safe compare

**Files:**
- Create: `src/lib/auth/password.ts`, `tests/unit/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from '@/lib/auth/password';

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
  });
  it('returns false for different strings of equal length', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
  });
  it('returns false for different-length inputs', () => {
    expect(timingSafeEqual('short', 'longerstring')).toBe(false);
  });
  it('handles empty inputs', () => {
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('', 'x')).toBe(false);
  });
  it('uses constant-time byte comparison (does not short-circuit)', () => {
    // Not a timing test — just assert it never throws on identical-prefix mismatches.
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('aXcdef', 'abcdef')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/password.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/lib/auth/password.ts`**

```ts
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  // Always compare over max length to avoid length-dependent early return.
  const len = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    const x = ba[i] ?? 0;
    const y = bb[i] ?? 0;
    diff |= x ^ y;
  }
  return diff === 0;
}
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/password.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/password.ts tests/unit/password.test.ts
git commit -m "feat(auth): constant-time password comparator"
```

---

## Task 9: HS256 JWT via Web Crypto

**Files:**
- Create: `src/lib/auth/jwt.ts`, `tests/unit/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '@/lib/auth/jwt';

const SECRET = 'test-secret-32-characters-minimum-xxxxxxx';

describe('jwt HS256', () => {
  it('signs and verifies a payload', async () => {
    const token = await signJwt({ jti: 'abcdef12345678901234x' }, SECRET, { expSeconds: 60 });
    const payload = await verifyJwt(token, SECRET);
    expect(payload?.jti).toBe('abcdef12345678901234x');
  });

  it('rejects tampered payloads', async () => {
    const token = await signJwt({ jti: 'j1' }, SECRET, { expSeconds: 60 });
    const [h, , s] = token.split('.');
    const tampered = [h, btoa(JSON.stringify({ jti: 'evil' })).replace(/=+$/, ''), s].join('.');
    expect(await verifyJwt(tampered, SECRET)).toBe(null);
  });

  it('rejects wrong secret', async () => {
    const token = await signJwt({ jti: 'j2' }, SECRET, { expSeconds: 60 });
    expect(await verifyJwt(token, 'wrong-secret')).toBe(null);
  });

  it('rejects expired tokens', async () => {
    const token = await signJwt({ jti: 'j3' }, SECRET, { expSeconds: -1 });
    expect(await verifyJwt(token, SECRET)).toBe(null);
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyJwt('not.a.jwt', SECRET)).toBe(null);
    expect(await verifyJwt('only-one-part', SECRET)).toBe(null);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/jwt.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/lib/auth/jwt.ts`**

```ts
function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface JwtPayload {
  jti: string;
  iat: number;
  exp: number;
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'> & Partial<Pick<JwtPayload, 'iat' | 'exp'>>,
  secret: string,
  opts: { expSeconds: number }
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = {
    jti: payload.jti,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + opts.expSeconds
  };
  const enc = new TextEncoder();
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(full)));
  const data = enc.encode(`${h}.${p}`);
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  return `${h}.${p}.${b64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(p))) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/jwt.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/jwt.ts tests/unit/jwt.test.ts
git commit -m "feat(auth): hs256 jwt via web crypto"
```

---

## Task 10: Session cookie helpers + login rate-limit

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/rate-limit.ts`, `tests/unit/session.test.ts`, `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: Write failing tests** — session

```ts
// tests/unit/session.test.ts
import { describe, it, expect } from 'vitest';
import { buildSessionCookie, parseSessionCookie, buildLogoutCookie } from '@/lib/auth/session';

describe('session cookie', () => {
  it('buildSessionCookie has HttpOnly, Secure, SameSite=Lax, Max-Age', () => {
    const c = buildSessionCookie('tok');
    expect(c).toMatch(/eia_session=tok/);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).toMatch(/Max-Age=604800/);
    expect(c).toMatch(/Path=\//);
  });

  it('buildLogoutCookie has Max-Age=0', () => {
    expect(buildLogoutCookie()).toMatch(/Max-Age=0/);
  });

  it('parseSessionCookie extracts token', () => {
    expect(parseSessionCookie('a=1; eia_session=tok; b=2')).toBe('tok');
  });

  it('parseSessionCookie returns null when missing', () => {
    expect(parseSessionCookie('a=1; b=2')).toBe(null);
  });
});
```

- [ ] **Step 2: Write failing tests** — rate-limit

```ts
// tests/unit/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordAttempt, isBlocked } from '@/lib/auth/rate-limit';

function fakeDb() {
  const rows: Array<{ ip: string; ts: string; ok: number }> = [];
  return {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT')) {
                rows.push({ ip: String(args[0]), ts: new Date().toISOString(), ok: Number(args[1]) });
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('COUNT')) {
                const ip = String(args[0]);
                const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const n = rows.filter((r) => r.ip === ip && r.ok === 0 && r.ts >= since).length;
                return ({ n } as unknown) as T;
              }
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database & { rows: Array<{ ip: string; ts: string; ok: number }> };
}

describe('rate-limit', () => {
  beforeEach(() => vi.useRealTimers());
  it('not blocked initially', async () => {
    const db = fakeDb();
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
  it('blocks after 5 failures in window', async () => {
    const db = fakeDb();
    for (let i = 0; i < 5; i++) await recordAttempt(db, '1.2.3.4', false);
    expect(await isBlocked(db, '1.2.3.4')).toBe(true);
  });
  it('does not block after 4 failures', async () => {
    const db = fakeDb();
    for (let i = 0; i < 4; i++) await recordAttempt(db, '1.2.3.4', false);
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
  it('successes do not count toward block', async () => {
    const db = fakeDb();
    for (let i = 0; i < 10; i++) await recordAttempt(db, '1.2.3.4', true);
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
});
```

- [ ] **Step 3: Run both — fail**

Run: `npm test -- tests/unit/session.test.ts tests/unit/rate-limit.test.ts`
Expected: module not found.

- [ ] **Step 4: Write `src/lib/auth/session.ts`**

```ts
import { SESSION_MAX_AGE_SECONDS } from '../constants';

export const SESSION_COOKIE = 'eia_session';

export function buildSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ].join('; ');
}

export function buildLogoutCookie(): string {
  return [`${SESSION_COOKIE}=`, 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=0'].join('; ');
}

export function parseSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const kv of header.split(';')) {
    const [k, v] = kv.trim().split('=');
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}
```

- [ ] **Step 5: Write `src/lib/auth/rate-limit.ts`**

```ts
import { LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MINUTES } from '../constants';

export async function recordAttempt(db: D1Database, ip: string, ok: boolean): Promise<void> {
  await db.prepare('INSERT INTO login_attempts (ip, ok) VALUES (?, ?)').bind(ip, ok ? 1 : 0).run();
}

export async function isBlocked(db: D1Database, ip: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE ip = ? AND ok = 0 AND ts >= datetime('now', ?)`
    )
    .bind(ip, `-${LOGIN_FAIL_WINDOW_MINUTES} minutes`)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= LOGIN_FAIL_MAX;
}
```

- [ ] **Step 6: Run — pass**

Run: `npm test -- tests/unit/session.test.ts tests/unit/rate-limit.test.ts`
Expected: 8 passing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/rate-limit.ts tests/unit/session.test.ts tests/unit/rate-limit.test.ts
git commit -m "feat(auth): session cookie helpers and login rate-limit"
```

---

## Task 11: Astro middleware (session + Origin + security headers)

**Files:**
- Create: `src/middleware.ts`, `tests/unit/middleware.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '@/middleware';

type MockCtx = {
  url: URL;
  request: Request;
  locals: App.Locals;
  redirect(path: string): Response;
};

function ctx(url: string, init?: RequestInit & { cookie?: string; origin?: string }, runtime?: Partial<Env>): MockCtx {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set('cookie', init.cookie);
  if (init?.origin) headers.set('origin', init.origin);
  return {
    url: new URL(url),
    request: new Request(url, { ...init, headers }),
    locals: { runtime: { env: { APP_ORIGIN: 'http://localhost:3000', JWT_SECRET: 'x'.repeat(32), ...runtime } } } as unknown as App.Locals,
    redirect(path: string) { return new Response(null, { status: 302, headers: { location: path } }); }
  };
}

describe('middleware', () => {
  it('adds CSP and X-Frame-Options to HTML response', async () => {
    const next = vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    const res = await onRequest(ctx('http://localhost:3000/login') as any, next as any);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('blocks POST with mismatched Origin', async () => {
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest(ctx('http://localhost:3000/api/projects', { method: 'POST', origin: 'http://evil.example' }) as any, next as any);
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows GET without Origin check', async () => {
    const next = vi.fn(async () => new Response('ok'));
    await onRequest(ctx('http://localhost:3000/api/projects', { method: 'GET' }) as any, next as any);
    expect(next).toHaveBeenCalled();
  });

  it('redirects unauthenticated api requests to 401', async () => {
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest(ctx('http://localhost:3000/api/projects', { method: 'GET' }) as any, next as any);
    expect(res.status).toBe(401);
  });

  it('redirects unauthenticated page requests to /login', async () => {
    const next = vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    const res = await onRequest(ctx('http://localhost:3000/') as any, next as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('allows /login without session', async () => {
    const next = vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    const res = await onRequest(ctx('http://localhost:3000/login') as any, next as any);
    expect(next).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/middleware.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/middleware.ts`**

```ts
import type { MiddlewareHandler } from 'astro';
import { parseSessionCookie } from '@/lib/auth/session';
import { verifyJwt } from '@/lib/auth/jwt';

const PUBLIC_PATHS = new Set(['/login', '/logout']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request, locals, redirect } = context;
  const env = locals.runtime.env;
  const method = request.method.toUpperCase();
  const isApi = url.pathname.startsWith('/api/');
  const isPublic = PUBLIC_PATHS.has(url.pathname);

  // 1) Origin check on mutating requests (except login/logout, which still must match our APP_ORIGIN).
  if (MUTATING.has(method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== env.APP_ORIGIN) {
      return new Response('origin mismatch', { status: 403 });
    }
  }

  // 2) Session check (skip for public paths).
  if (!isPublic) {
    const token = parseSessionCookie(request.headers.get('cookie'));
    const payload = token ? await verifyJwt(token, env.JWT_SECRET) : null;
    if (!payload) {
      if (isApi) return new Response('unauthorized', { status: 401 });
      return redirect('/login');
    }
    locals.session = { jti: payload.jti };
  }

  const res = await next();

  // 3) Security headers on HTML responses.
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/html')) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(k, v);
    }
  }
  return res;
};
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/middleware.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts tests/unit/middleware.test.ts
git commit -m "feat(mw): session, origin, security-headers middleware"
```

---

## Task 12: `/login` page + `/logout` handler

**Files:**
- Create: `src/pages/login.astro`, `src/pages/logout.ts`, `src/lib/auth/turnstile.ts`

- [ ] **Step 1: Write `src/lib/auth/turnstile.ts`**

```ts
export async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!r.ok) return false;
  const j = (await r.json()) as { success: boolean };
  return j.success === true;
}
```

- [ ] **Step 2: Write `src/pages/login.astro`**

```astro
---
import { loginSchema } from '@/lib/schemas';
import { timingSafeEqual } from '@/lib/auth/password';
import { signJwt } from '@/lib/auth/jwt';
import { buildSessionCookie } from '@/lib/auth/session';
import { isBlocked, recordAttempt } from '@/lib/auth/rate-limit';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { newJti } from '@/lib/id';
import { LOGIN_MIN_RESPONSE_MS, SESSION_MAX_AGE_SECONDS } from '@/lib/constants';

const env = Astro.locals.runtime.env;
const ip = Astro.request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
let error: string | null = null;
const started = Date.now();

if (Astro.request.method === 'POST') {
  if (await isBlocked(env.DB, ip)) {
    error = '잠시 후 다시 시도하세요.';
  } else {
    const form = await Astro.request.formData();
    const parsed = loginSchema.safeParse({
      password: form.get('password'),
      turnstileToken: form.get('cf-turnstile-response')
    });
    if (!parsed.success) {
      await recordAttempt(env.DB, ip, false);
      error = '입력값을 다시 확인해 주세요.';
    } else {
      const turnstileOk = await verifyTurnstile(parsed.data.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
      const pwOk = timingSafeEqual(parsed.data.password, env.APP_PASSWORD);
      if (turnstileOk && pwOk) {
        await recordAttempt(env.DB, ip, true);
        const token = await signJwt({ jti: newJti() }, env.JWT_SECRET, { expSeconds: SESSION_MAX_AGE_SECONDS });
        const elapsed = Date.now() - started;
        if (elapsed < LOGIN_MIN_RESPONSE_MS) {
          await new Promise((r) => setTimeout(r, LOGIN_MIN_RESPONSE_MS - elapsed));
        }
        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': buildSessionCookie(token) }
        });
      }
      await recordAttempt(env.DB, ip, false);
      error = '로그인에 실패했습니다.';
    }
  }
  const elapsed = Date.now() - started;
  if (elapsed < LOGIN_MIN_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, LOGIN_MIN_RESPONSE_MS - elapsed));
  }
}
---
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>로그인 · eia-workbench</title>
  <link rel="stylesheet" href="/src/styles/global.css" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body class="min-h-screen grid place-items-center bg-bg">
  <form method="post" class="w-full max-w-sm bg-surface border border-border rounded-md p-6 space-y-4">
    <h1 class="text-h1">eia-workbench · v0 파일럿</h1>
    <p class="text-small text-text-secondary">
      이 인스턴스의 프로젝트는 인증된 모든 사용자에게 보입니다. 조직별 격리가 필요하면 별도 배포를 사용하세요.
    </p>
    <label class="block space-y-1">
      <span class="text-body font-semibold">패스워드 *</span>
      <input type="password" name="password" required aria-required="true"
        class="w-full h-9 px-3 border border-border rounded-md bg-surface" />
    </label>
    <div class="cf-turnstile" data-sitekey={env.TURNSTILE_SITE_KEY} data-theme="light"></div>
    {error && <p class="text-small text-danger" role="alert">{error}</p>}
    <button type="submit" class="w-full h-9 rounded-md bg-primary text-white hover:bg-primary-hover">로그인</button>
  </form>
</body>
</html>
```

- [ ] **Step 3: Write `src/pages/logout.ts`**

```ts
import type { APIRoute } from 'astro';
import { buildLogoutCookie } from '@/lib/auth/session';

export const POST: APIRoute = async () =>
  new Response(null, {
    status: 303,
    headers: { location: '/login', 'set-cookie': buildLogoutCookie() }
  });

export const GET: APIRoute = () => new Response('method not allowed', { status: 405 });
```

- [ ] **Step 4: Smoke test via dev server**

Run:
```bash
npm run db:migrate:local
npm run dev
```
Visit `http://localhost:3000/login`. Enter the password from `.dev.vars`, Turnstile test key always passes.
Expected: redirect to `/` (which will 404 until T20 — that's OK here).

- [ ] **Step 5: Commit**

```bash
git add src/pages/login.astro src/pages/logout.ts src/lib/auth/turnstile.ts
git commit -m "feat(auth): login page with turnstile + logout handler"
```

---

## Task 13: KOSTAT regions + lookup utility

**Files:**
- Create: `src/data/administrative-divisions.json`, `src/lib/kostat/index.ts`, `tests/unit/kostat.test.ts`, `scripts/fetch-kostat.md`

**Context:** Bootstrap the dataset from a known open list (e.g. 행정안전부 행정표준코드 opendata CSV). For this plan we embed a small curated sample for tests; full dataset import is a one-line task the engineer runs before production.

- [ ] **Step 1: Write `src/data/administrative-divisions.json`** (seed sample — 시/도 × 시/군/구)

```json
{
  "version": "2024-01",
  "source": "KOSTAT 행정표준코드 (관리번호)",
  "regions": [
    { "code": "11", "name": "서울특별시", "subs": [
      { "code": "11110", "name": "종로구" },
      { "code": "11140", "name": "중구" }
    ]},
    { "code": "42", "name": "강원특별자치도", "subs": [
      { "code": "42750", "name": "평창군" },
      { "code": "42820", "name": "정선군" }
    ]},
    { "code": "47", "name": "경상북도", "subs": [
      { "code": "47920", "name": "영양군" },
      { "code": "47770", "name": "청송군" }
    ]}
  ]
}
```

- [ ] **Step 2: Write `scripts/fetch-kostat.md`**

```markdown
# Fetch full KOSTAT administrative divisions

Replace `src/data/administrative-divisions.json` from 행정안전부 행정표준코드 공공데이터
(https://www.code.go.kr) before production. Keep the JSON shape identical:
`{ version, source, regions: [{ code, name, subs: [{ code, name }] }] }`.
Seed values ship with 3 시/도 × 2 시/군/구 for unit tests — replace with full ~250 시/군/구.
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { loadRegions, isValidRegionCode, isValidSubCode, labelFor } from '@/lib/kostat';

describe('kostat', () => {
  it('loads at least 3 시/도', () => {
    const r = loadRegions();
    expect(r.regions.length).toBeGreaterThanOrEqual(3);
  });
  it('validates region codes', () => {
    expect(isValidRegionCode('42')).toBe(true);
    expect(isValidRegionCode('99')).toBe(false);
  });
  it('validates sub codes within parent', () => {
    expect(isValidSubCode('42', '42750')).toBe(true);
    expect(isValidSubCode('42', '11110')).toBe(false);
    expect(isValidSubCode('99', '11110')).toBe(false);
  });
  it('returns labels', () => {
    expect(labelFor('42')).toBe('강원특별자치도');
    expect(labelFor('42', '42750')).toBe('평창군');
    expect(labelFor('99')).toBe(null);
  });
});
```

- [ ] **Step 4: Run — fail**

Run: `npm test -- tests/unit/kostat.test.ts`
Expected: module not found.

- [ ] **Step 5: Write `src/lib/kostat/index.ts`**

```ts
import data from '@/data/administrative-divisions.json';

export interface Sub { code: string; name: string; }
export interface Region { code: string; name: string; subs: Sub[]; }
export interface RegionDataset { version: string; source: string; regions: Region[]; }

export function loadRegions(): RegionDataset {
  return data as RegionDataset;
}

export function isValidRegionCode(code: string): boolean {
  return loadRegions().regions.some((r) => r.code === code);
}

export function isValidSubCode(regionCode: string, subCode: string): boolean {
  const r = loadRegions().regions.find((x) => x.code === regionCode);
  return !!r && r.subs.some((s) => s.code === subCode);
}

export function labelFor(regionCode: string, subCode?: string): string | null {
  const r = loadRegions().regions.find((x) => x.code === regionCode);
  if (!r) return null;
  if (subCode === undefined) return r.name;
  const s = r.subs.find((x) => x.code === subCode);
  return s ? s.name : null;
}
```

- [ ] **Step 6: Allow JSON imports in TS** — modify `tsconfig.json` `compilerOptions`: add `"resolveJsonModule": true`.

- [ ] **Step 7: Run — pass**

Run: `npm test -- tests/unit/kostat.test.ts`
Expected: 4 passing.

- [ ] **Step 8: Commit**

```bash
git add src/data/administrative-divisions.json src/lib/kostat/ tests/unit/kostat.test.ts scripts/fetch-kostat.md tsconfig.json
git commit -m "feat(kostat): region dataset loader + validators"
```

---

## Task 14: `POST/GET /api/projects` (create + list)

**Files:**
- Create: `src/pages/api/projects/index.ts`

- [ ] **Step 1: Write failing integration test** — `tests/unit/api-projects.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mini in-memory D1 mock
function memDb() {
  const projects: Record<string, Record<string, unknown>> = {};
  return {
    projects,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO projects')) {
                const id = String(args[0]);
                projects[id] = {
                  id, owner_id: args[1], name: args[2], industry: args[3],
                  site_region_code: args[4], site_region: args[5],
                  site_sub_region_code: args[6], site_sub_region: args[7],
                  capacity_mw: args[8], created_at: new Date().toISOString(), deleted_at: null
                };
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('WHERE id = ?')) {
                const id = String(args[0]);
                return (projects[id] as unknown) as T;
              }
              return null;
            },
            async all<T>() {
              const rows = Object.values(projects).filter((p) => !p.deleted_at);
              return ({ results: rows as T[] });
            }
          };
        }
      };
    }
  } as unknown as D1Database & { projects: Record<string, unknown> };
}

async function callRoute(method: 'GET' | 'POST', body?: unknown, db?: D1Database) {
  const { POST, GET } = await import('@/pages/api/projects/index');
  const req = new Request('http://localhost:3000/api/projects', {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: body ? JSON.stringify(body) : undefined
  });
  const ctx = {
    request: req,
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j1' } } as unknown as App.Locals
  };
  if (method === 'POST') return POST(ctx as any);
  return GET(ctx as any);
}

describe('POST /api/projects', () => {
  it('creates a project and returns 201 with id', async () => {
    const db = memDb();
    const res = await callRoute('POST', { name: '강원 풍력 1단지', industry: 'onshore_wind' }, db);
    expect(res.status).toBe(201);
    const j = await res.json() as { id: string };
    expect(j.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('returns 400 for invalid body', async () => {
    const db = memDb();
    const res = await callRoute('POST', { name: '', industry: 'onshore_wind' }, db);
    expect(res.status).toBe(400);
  });

  it('returns 400 when region codes are invalid', async () => {
    const db = memDb();
    const res = await callRoute('POST',
      { name: 'x', industry: 'onshore_wind', site_region_code: '99' }, db);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('lists alive projects', async () => {
    const db = memDb();
    await callRoute('POST', { name: 'A', industry: 'onshore_wind' }, db);
    const res = await callRoute('GET', undefined, db);
    expect(res.status).toBe(200);
    const j = await res.json() as { projects: unknown[] };
    expect(j.projects.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/api-projects.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/pages/api/projects/index.ts`**

```ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { projectCreateSchema } from '@/lib/schemas';
import { newProjectId } from '@/lib/id';
import { isValidRegionCode, isValidSubCode } from '@/lib/kostat';
import { logger } from '@/lib/logger';

const bodySchema = projectCreateSchema.superRefine((v, ctx) => {
  if (v.site_region_code && !isValidRegionCode(v.site_region_code)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_region_code'], message: 'invalid region code' });
  }
  if (v.site_region_code && v.site_sub_region_code && !isValidSubCode(v.site_region_code, v.site_sub_region_code)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_sub_region_code'], message: 'invalid sub code' });
  }
});

export const POST: APIRoute = async ({ request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
    }
    const id = newProjectId();
    await env.DB.prepare(
      `INSERT INTO projects
        (id, owner_id, name, industry, site_region_code, site_region, site_sub_region_code, site_sub_region, capacity_mw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, null, parsed.data.name, parsed.data.industry,
      parsed.data.site_region_code ?? null, parsed.data.site_region ?? null,
      parsed.data.site_sub_region_code ?? null, parsed.data.site_sub_region ?? null,
      parsed.data.capacity_mw ?? null
    ).run();
    logger.info({ route: '/api/projects', method: 'POST', status: 201, latencyMs: Date.now() - t0, jti });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ route: '/api/projects', method: 'POST', status: 500, latencyMs: Date.now() - t0, jti, error: err as Error });
    return Response.json({ error: 'internal' }, { status: 500 });
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const { results } = await env.DB.prepare(
    `SELECT id, name, industry, site_region, site_sub_region, capacity_mw, created_at
     FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC`
  ).all();
  logger.info({ route: '/api/projects', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ projects: results });
};
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/api-projects.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/projects/index.ts tests/unit/api-projects.test.ts
git commit -m "feat(api): POST and GET /api/projects"
```

---

## Task 15: `GET/DELETE /api/projects/[id]` + `PATCH .../restore`

**Files:**
- Create: `src/pages/api/projects/[id]/index.ts`, `src/pages/api/projects/[id]/restore.ts`, `tests/unit/api-project-one.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';

function memDb() {
  const rows: Record<string, any> = {
    'p1': { id: 'p1', name: 'A', industry: 'onshore_wind', site_region: null, site_sub_region: null, capacity_mw: null, created_at: 'x', deleted_at: null }
  };
  return {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          return {
            async run() {
              if (sql.includes('UPDATE projects SET deleted_at')) {
                if (rows[args[0]]) rows[args[0]].deleted_at = 'now';
              }
              if (sql.includes('UPDATE projects SET deleted_at = NULL')) {
                if (rows[args[0]]) rows[args[0]].deleted_at = null;
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('SELECT')) return rows[args[0]] as T;
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

async function call(method: 'GET' | 'DELETE' | 'PATCH', id: string, db: D1Database) {
  if (method === 'PATCH') {
    const { PATCH } = await import('@/pages/api/projects/[id]/restore');
    return PATCH({
      request: new Request(`http://localhost:3000/api/projects/${id}/restore`, { method: 'PATCH', headers: { origin: 'http://localhost:3000' } }),
      params: { id },
      locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
    } as any);
  }
  const mod = await import('@/pages/api/projects/[id]/index');
  const handler = method === 'GET' ? mod.GET : mod.DELETE;
  return handler({
    request: new Request(`http://localhost:3000/api/projects/${id}`, { method, headers: { origin: 'http://localhost:3000' } }),
    params: { id },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
  } as any);
}

describe('GET /api/projects/[id]', () => {
  it('returns the project', async () => {
    const db = memDb();
    const res = await call('GET', 'p1', db);
    expect(res.status).toBe(200);
  });
  it('returns 404 for unknown id', async () => {
    const db = memDb();
    const res = await call('GET', 'zzz', db);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/[id]', () => {
  it('soft-deletes', async () => {
    const db = memDb() as any;
    await call('DELETE', 'p1', db);
    expect(db.rows.p1.deleted_at).toBeTruthy();
  });
});

describe('PATCH /api/projects/[id]/restore', () => {
  it('clears deleted_at', async () => {
    const db = memDb() as any;
    db.rows.p1.deleted_at = '2024-01-01';
    await call('PATCH', 'p1', db);
    expect(db.rows.p1.deleted_at).toBe(null);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/api-project-one.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/pages/api/projects/[id]/index.ts`**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id!;
  const row = await env.DB.prepare(
    `SELECT id, name, industry, site_region_code, site_region, site_sub_region_code, site_sub_region, capacity_mw, created_at
     FROM projects WHERE id = ? AND deleted_at IS NULL`
  ).bind(id).first();
  if (!row) {
    logger.info({ route: '/api/projects/[id]', method: 'GET', status: 404, latencyMs: Date.now() - t0, jti });
    return new Response('not found', { status: 404 });
  }
  logger.info({ route: '/api/projects/[id]', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ project: row });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id!;
  await env.DB.prepare(
    `UPDATE projects SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
  ).bind(id).run();
  // Also soft-delete child uploads, so "최근 삭제" drawer shows them under the parent.
  await env.DB.prepare(
    `UPDATE uploads SET deleted_at = datetime('now') WHERE project_id = ? AND deleted_at IS NULL`
  ).bind(id).run();
  logger.info({ route: '/api/projects/[id]', method: 'DELETE', status: 204, latencyMs: Date.now() - t0, jti });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 4: Write `src/pages/api/projects/[id]/restore.ts`**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const PATCH: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id!;
  await env.DB.prepare(
    `UPDATE projects SET deleted_at = NULL WHERE id = ?`
  ).bind(id).run();
  logger.info({ route: '/api/projects/[id]/restore', method: 'PATCH', status: 204, latencyMs: Date.now() - t0, jti });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 5: Run — pass**

Run: `npm test -- tests/unit/api-project-one.test.ts`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/projects/[id]/ tests/unit/api-project-one.test.ts
git commit -m "feat(api): GET/DELETE /api/projects/[id] + PATCH restore"
```

---

## Task 16: Magic bytes + R2 key utilities

**Files:**
- Create: `src/lib/upload/magic-bytes.ts`, `src/lib/upload/r2-key.ts`, `tests/unit/magic-bytes.test.ts`, `tests/unit/r2-key.test.ts`

- [ ] **Step 1: Write failing tests** — magic bytes

```ts
// tests/unit/magic-bytes.test.ts
import { describe, it, expect } from 'vitest';
import { validateMagicBytes } from '@/lib/upload/magic-bytes';

function bytes(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g)!;
  return new Uint8Array(m.map((h) => parseInt(h, 16)));
}

describe('validateMagicBytes', () => {
  it('accepts PDF magic %PDF-', async () => {
    expect(await validateMagicBytes(bytes('255044462d312e34'), 'application/pdf')).toBe(true);
  });
  it('rejects PDF mime with non-PDF content', async () => {
    expect(await validateMagicBytes(bytes('deadbeef'), 'application/pdf')).toBe(false);
  });
  it('accepts DOCX (zip + [Content_Types].xml entry)', async () => {
    const docx = await makeMinimalDocx();
    expect(await validateMagicBytes(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
  });
  it('rejects DOCX mime with generic zip', async () => {
    const zip = await makeGenericZip();
    expect(await validateMagicBytes(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
  });
  it('accepts valid UTF-8 for text/plain', async () => {
    expect(await validateMagicBytes(new TextEncoder().encode('안녕'), 'text/plain')).toBe(true);
  });
  it('rejects invalid UTF-8 for text/plain', async () => {
    expect(await validateMagicBytes(new Uint8Array([0xff, 0xfe, 0xfd]), 'text/plain')).toBe(false);
  });
});

async function makeMinimalDocx(): Promise<Uint8Array> {
  // Minimal zip with a single entry "[Content_Types].xml".
  const name = '[Content_Types].xml';
  const content = new TextEncoder().encode('<?xml version="1.0"?><Types/>');
  // We'll use the native CompressionStream via JSZip-less handcrafted zip
  // For simplicity in tests, return the first 32 bytes: PK\x03\x04 + local file header + filename bytes.
  const fname = new TextEncoder().encode(name);
  const header = new Uint8Array(30 + fname.length + content.length);
  header[0] = 0x50; header[1] = 0x4b; header[2] = 0x03; header[3] = 0x04;
  // Compression method, CRC, sizes left 0 for test — magic-bytes only scans header + entry name.
  new DataView(header.buffer).setUint16(26, fname.length, true);
  new DataView(header.buffer).setUint16(28, 0, true);
  header.set(fname, 30);
  header.set(content, 30 + fname.length);
  return header;
}

async function makeGenericZip(): Promise<Uint8Array> {
  const fname = new TextEncoder().encode('readme.txt');
  const header = new Uint8Array(30 + fname.length);
  header[0] = 0x50; header[1] = 0x4b; header[2] = 0x03; header[3] = 0x04;
  new DataView(header.buffer).setUint16(26, fname.length, true);
  header.set(fname, 30);
  return header;
}
```

- [ ] **Step 2: Write failing tests** — r2-key

```ts
// tests/unit/r2-key.test.ts
import { describe, it, expect } from 'vitest';
import { buildR2Key } from '@/lib/upload/r2-key';

describe('buildR2Key', () => {
  it('uses projects/<pid>/<nanoid16> format', () => {
    const k = buildR2Key('abc123DEF456');
    expect(k).toMatch(/^projects\/abc123DEF456\/[A-Za-z0-9_-]{16}$/);
  });
  it('never includes the original filename', () => {
    const k = buildR2Key('p1');
    expect(k).not.toMatch(/\.pdf|\.docx|\.txt/);
  });
  it('is unique across 1000 calls for the same project', () => {
    const set = new Set(Array.from({ length: 1000 }, () => buildR2Key('p1')));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 3: Run both — fail**

Run: `npm test -- tests/unit/magic-bytes.test.ts tests/unit/r2-key.test.ts`
Expected: modules not found.

- [ ] **Step 4: Write `src/lib/upload/r2-key.ts`**

```ts
import { newR2Suffix } from '@/lib/id';
export function buildR2Key(projectId: string): string {
  return `projects/${projectId}/${newR2Suffix()}`;
}
```

- [ ] **Step 5: Write `src/lib/upload/magic-bytes.ts`**

```ts
import type { AllowedMime } from '@/lib/constants';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK..

function startsWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (haystack.length < needle.length) return false;
  for (let i = 0; i < needle.length; i++) if (haystack[i] !== needle[i]) return false;
  return true;
}

function hasEntry(zip: Uint8Array, name: string): boolean {
  // Scan local file headers for name.
  const target = new TextEncoder().encode(name);
  outer: for (let i = 0; i + 30 + target.length < zip.length; i++) {
    if (zip[i] !== 0x50 || zip[i + 1] !== 0x4b || zip[i + 2] !== 0x03 || zip[i + 3] !== 0x04) continue;
    const nameLen = zip[i + 26]! | (zip[i + 27]! << 8);
    if (nameLen !== target.length) continue;
    const off = i + 30;
    for (let j = 0; j < target.length; j++) if (zip[off + j] !== target[j]) continue outer;
    return true;
  }
  return false;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export async function validateMagicBytes(bytes: Uint8Array, mime: AllowedMime): Promise<boolean> {
  if (mime === 'application/pdf') return startsWith(bytes, PDF);
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return startsWith(bytes, ZIP) && hasEntry(bytes, '[Content_Types].xml');
  }
  if (mime === 'text/plain') return isValidUtf8(bytes);
  return false;
}
```

- [ ] **Step 6: Run — pass**

Run: `npm test -- tests/unit/magic-bytes.test.ts tests/unit/r2-key.test.ts`
Expected: 9 passing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/upload/ tests/unit/magic-bytes.test.ts tests/unit/r2-key.test.ts
git commit -m "feat(upload): magic-bytes validator and r2-key builder"
```

---

## Task 17: `POST /api/projects/[id]/uploads` (full pipeline)

**Files:**
- Create: `src/pages/api/projects/[id]/uploads/index.ts`, `tests/unit/api-uploads-post.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';

function memState() {
  const projects: Record<string, any> = { p1: { id: 'p1', deleted_at: null } };
  const uploads: Record<string, any> = {};
  const objects: Record<string, Uint8Array> = {};
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO uploads')) {
                uploads[String(args[0])] = {
                  id: args[0], project_id: args[1], r2_key: args[2], sha256: args[3],
                  original_name: args[4], mime: args[5], size_bytes: args[6],
                  created_at: 'x', deleted_at: null
                };
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('FROM projects WHERE id = ?')) return projects[String(args[0])] as T;
              if (sql.includes('COALESCE(SUM')) {
                const pid = String(args[0]);
                const rows = Object.values(uploads).filter((u) => u.project_id === pid && !u.deleted_at);
                return ({ total: rows.reduce((s, r) => s + r.size_bytes, 0), n: rows.length } as unknown) as T;
              }
              if (sql.includes('FROM uploads WHERE project_id = ? AND sha256 = ?')) {
                const pid = String(args[0]); const sha = String(args[1]);
                return (Object.values(uploads).find((u) => u.project_id === pid && u.sha256 === sha && !u.deleted_at) as unknown) as T;
              }
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  const r2 = {
    async put(key: string, body: ArrayBuffer) { objects[key] = new Uint8Array(body); return { key } as R2Object; }
  } as unknown as R2Bucket;
  return { db, r2, projects, uploads, objects };
}

async function call(form: FormData, env: { DB: D1Database; UPLOADS: R2Bucket }, projectId = 'p1') {
  const { POST } = await import('@/pages/api/projects/[id]/uploads/index');
  return POST({
    request: new Request(`http://localhost:3000/api/projects/${projectId}/uploads`, {
      method: 'POST', body: form, headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: projectId },
    locals: { runtime: { env }, session: { jti: 'j' } }
  } as any);
}

function fd(name: string, content: Uint8Array, mime: string): FormData {
  const form = new FormData();
  form.append('file', new Blob([content], { type: mime }), name);
  return form;
}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe('POST /api/projects/[id]/uploads', () => {
  it('accepts valid PDF', async () => {
    const s = memState();
    const res = await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(201);
    expect(Object.values(s.uploads).length).toBe(1);
  });
  it('rejects HWP with 415', async () => {
    const s = memState();
    const res = await call(fd('a.hwp', new Uint8Array([1, 2, 3]), 'application/x-hwp'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(415);
  });
  it('rejects size over 30MB', async () => {
    const s = memState();
    const big = new Uint8Array(31 * 1024 * 1024);
    big.set(PDF);
    const res = await call(fd('big.pdf', big, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(413);
  });
  it('rejects duplicate sha256 with 409', async () => {
    const s = memState();
    await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    const res = await call(fd('a-copy.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(409);
  });
  it('rejects when project file count reaches 30', async () => {
    const s = memState();
    for (let i = 0; i < 30; i++) {
      const uniq = new Uint8Array(PDF.length + 4);
      uniq.set(PDF);
      new DataView(uniq.buffer).setUint32(PDF.length, i);
      await call(fd(`f${i}.pdf`, uniq, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    }
    const extra = new Uint8Array(PDF.length + 4);
    extra.set(PDF); new DataView(extra.buffer).setUint32(PDF.length, 999);
    const res = await call(fd('overflow.pdf', extra, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(413);
  });
  it('rejects magic-bytes mismatch with 415', async () => {
    const s = memState();
    const res = await call(fd('fake.pdf', new Uint8Array([1, 2, 3]), 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(415);
  });
  it('404 when project does not exist', async () => {
    const s = memState();
    const res = await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 }, 'zzz');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/api-uploads-post.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/pages/api/projects/[id]/uploads/index.ts`**

```ts
import type { APIRoute } from 'astro';
import { uploadMetaSchema } from '@/lib/schemas';
import { MAX_FILE_BYTES, MAX_PROJECT_BYTES, MAX_PROJECT_FILES } from '@/lib/constants';
import { validateMagicBytes } from '@/lib/upload/magic-bytes';
import { buildR2Key } from '@/lib/upload/r2-key';
import { newUploadId } from '@/lib/id';
import { logger } from '@/lib/logger';

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projectId = params.id!;

  const project = await env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`
  ).bind(projectId).first<{ id: string }>();
  if (!project) return new Response('project not found', { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('invalid form', { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) return new Response('missing file', { status: 400 });

  const meta = uploadMetaSchema.safeParse({
    original_name: (file as File).name ?? 'unnamed',
    mime: file.type,
    size_bytes: file.size
  });
  if (!meta.success) return new Response('unsupported media type', { status: 415 });

  if (file.size > MAX_FILE_BYTES) return new Response('file too large', { status: 413 });

  const quota = await env.DB.prepare(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS n FROM uploads
     WHERE project_id = ? AND deleted_at IS NULL`
  ).bind(projectId).first<{ total: number; n: number }>();
  const total = quota?.total ?? 0;
  const n = quota?.n ?? 0;
  if (n >= MAX_PROJECT_FILES) return new Response('project file-count exceeded', { status: 413 });
  if (total + file.size > MAX_PROJECT_BYTES) return new Response('project quota exceeded', { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ok = await validateMagicBytes(bytes, meta.data.mime);
  if (!ok) return new Response('content does not match mime', { status: 415 });

  const sha = await sha256Hex(bytes.buffer);
  const dup = await env.DB.prepare(
    `SELECT id, original_name, created_at FROM uploads WHERE project_id = ? AND sha256 = ? AND deleted_at IS NULL`
  ).bind(projectId, sha).first<{ id: string; original_name: string; created_at: string }>();
  if (dup) {
    logger.info({ route: '/api/projects/[id]/uploads', method: 'POST', status: 409, latencyMs: Date.now() - t0, jti });
    return Response.json({ error: 'duplicate', original_name: dup.original_name, created_at: dup.created_at }, { status: 409 });
  }

  const id = newUploadId();
  const key = buildR2Key(projectId);
  await env.UPLOADS.put(key, bytes);
  try {
    await env.DB.prepare(
      `INSERT INTO uploads (id, project_id, r2_key, sha256, original_name, mime, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, projectId, key, sha, meta.data.original_name, meta.data.mime, meta.data.size_bytes).run();
  } catch (err) {
    // Compensate if D1 insert fails (e.g. unique-index race).
    await env.UPLOADS.delete(key).catch(() => {});
    logger.error({ route: '/api/projects/[id]/uploads', method: 'POST', status: 500, latencyMs: Date.now() - t0, jti, error: err as Error });
    return new Response('internal', { status: 500 });
  }

  logger.info({ route: '/api/projects/[id]/uploads', method: 'POST', status: 201, latencyMs: Date.now() - t0, jti });
  return Response.json({ id, r2_key: key, sha256: sha }, { status: 201 });
};

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projectId = params.id!;
  const { results } = await env.DB.prepare(
    `SELECT id, original_name, mime, size_bytes, created_at FROM uploads
     WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
  ).bind(projectId).all();
  logger.info({ route: '/api/projects/[id]/uploads', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ uploads: results });
};
```

- [ ] **Step 4: Run — pass**

Run: `npm test -- tests/unit/api-uploads-post.test.ts`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/projects/[id]/uploads/index.ts tests/unit/api-uploads-post.test.ts
git commit -m "feat(api): POST/GET /api/projects/[id]/uploads with full validation"
```

---

## Task 18: `DELETE /api/projects/[id]/uploads/[uploadId]` + restore

**Files:**
- Create: `src/pages/api/projects/[id]/uploads/[uploadId]/index.ts`, `src/pages/api/projects/[id]/uploads/[uploadId]/restore.ts`, `tests/unit/api-upload-one.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';

function memState() {
  const uploads: Record<string, any> = {
    u1: { id: 'u1', project_id: 'p1', r2_key: 'projects/p1/abc', deleted_at: null }
  };
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          return {
            async run() {
              if (sql.includes('UPDATE uploads SET deleted_at = datetime')) {
                if (uploads[args[0]]) uploads[args[0]].deleted_at = 'now';
              }
              if (sql.includes('UPDATE uploads SET deleted_at = NULL')) {
                if (uploads[args[0]]) uploads[args[0]].deleted_at = null;
              }
              return { success: true };
            },
            async first<T>() {
              return (uploads[args[0]] as unknown) as T;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  return { db, uploads };
}

async function call(method: 'DELETE' | 'PATCH', uploadId: string, db: D1Database) {
  const modPath = method === 'PATCH'
    ? '@/pages/api/projects/[id]/uploads/[uploadId]/restore'
    : '@/pages/api/projects/[id]/uploads/[uploadId]/index';
  const mod = await import(modPath);
  const handler = method === 'PATCH' ? mod.PATCH : mod.DELETE;
  return handler({
    request: new Request(`http://x/api/projects/p1/uploads/${uploadId}${method === 'PATCH' ? '/restore' : ''}`, {
      method, headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: 'p1', uploadId },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
  } as any);
}

describe('DELETE /api/projects/[id]/uploads/[uploadId]', () => {
  it('soft-deletes upload', async () => {
    const s = memState();
    const res = await call('DELETE', 'u1', s.db);
    expect(res.status).toBe(204);
    expect(s.uploads.u1.deleted_at).toBeTruthy();
  });
});

describe('PATCH /api/projects/[id]/uploads/[uploadId]/restore', () => {
  it('clears deleted_at', async () => {
    const s = memState();
    s.uploads.u1.deleted_at = 'x';
    const res = await call('PATCH', 'u1', s.db);
    expect(res.status).toBe(204);
    expect(s.uploads.u1.deleted_at).toBe(null);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/api-upload-one.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `src/pages/api/projects/[id]/uploads/[uploadId]/index.ts`**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const DELETE: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const uploadId = params.uploadId!;
  await env.DB.prepare(
    `UPDATE uploads SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
  ).bind(uploadId).run();
  logger.info({ route: '/api/projects/[id]/uploads/[uploadId]', method: 'DELETE', status: 204, latencyMs: Date.now() - t0, jti });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 4: Write `src/pages/api/projects/[id]/uploads/[uploadId]/restore.ts`**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const PATCH: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const uploadId = params.uploadId!;
  await env.DB.prepare(
    `UPDATE uploads SET deleted_at = NULL WHERE id = ?`
  ).bind(uploadId).run();
  logger.info({ route: '/api/projects/[id]/uploads/[uploadId]/restore', method: 'PATCH', status: 204, latencyMs: Date.now() - t0, jti });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 5: Run — pass**

Run: `npm test -- tests/unit/api-upload-one.test.ts`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/projects/[id]/uploads/[uploadId]/ tests/unit/api-upload-one.test.ts
git commit -m "feat(api): DELETE upload + restore endpoints"
```

---

## Task 19: `AppLayout` + `PilotWarningBanner` + toast store

**Files:**
- Create: `src/layouts/AppLayout.astro`, `src/components/PilotWarningBanner.astro`, `src/components/toast-store.ts`, `src/components/Toast.tsx`

- [ ] **Step 1: Write `src/components/PilotWarningBanner.astro`**

```astro
---
---
<div role="status" class="bg-warning-bg border-b border-border px-6 py-3 text-small text-warning">
  <strong class="font-semibold">v0 파일럿</strong> ·
  이 인스턴스의 프로젝트는 인증된 모든 사용자에게 보입니다. 조직별 격리가 필요하면 별도 배포를 사용하세요.
  본 도구는 검토 보조이며 현지조사를 대체하지 않습니다.
</div>
```

- [ ] **Step 2: Write `src/components/toast-store.ts`**

```ts
import { atom } from 'nanostores';

export type Toast = { id: string; kind: 'info' | 'warn' | 'error'; message: string };
export const $toasts = atom<Toast[]>([]);

export function pushToast(kind: Toast['kind'], message: string) {
  const id = Math.random().toString(36).slice(2);
  $toasts.set([...$toasts.get(), { id, kind, message }]);
  setTimeout(() => $toasts.set($toasts.get().filter((t) => t.id !== id)), 5000);
}

export function dismiss(id: string) {
  $toasts.set($toasts.get().filter((t) => t.id !== id));
}
```

- [ ] **Step 3: Write `src/components/Toast.tsx`**

```tsx
import { useStore } from '@nanostores/react';
import { $toasts, dismiss } from './toast-store';

const KIND_STYLE: Record<string, string> = {
  info: 'bg-surface border-border text-text-primary',
  warn: 'bg-warning-bg border-warning text-warning',
  error: 'bg-danger-bg border-danger text-danger'
};

export default function Toast() {
  const items = useStore($toasts);
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" role="region" aria-label="알림">
      {items.map((t) => (
        <div key={t.id} role="alert"
             className={`border rounded-md px-4 py-2 text-small shadow-sm ${KIND_STYLE[t.kind]}`}>
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="닫기" className="ml-3 text-text-tertiary">×</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/layouts/AppLayout.astro`**

```astro
---
import PilotWarningBanner from '@/components/PilotWarningBanner.astro';
import Toast from '@/components/Toast';
interface Props { title: string; }
const { title } = Astro.props;
---
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <link rel="stylesheet" href="/src/styles/global.css" />
</head>
<body class="min-h-screen bg-bg text-text-primary">
  <PilotWarningBanner />
  <header class="border-b border-border bg-surface px-6 py-3 flex items-center justify-between">
    <a href="/" class="font-semibold">eia-workbench</a>
    <form method="post" action="/logout" class="inline">
      <button type="submit" class="text-small text-text-secondary hover:text-text-primary">로그아웃</button>
    </form>
  </header>
  <main class="max-w-content mx-auto px-6 py-8">
    <slot />
  </main>
  <Toast client:load />
</body>
</html>
```

- [ ] **Step 5: Smoke build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ src/components/
git commit -m "feat(ui): app layout, pilot banner, toast store"
```

---

## Task 20: `/` project list page

**Files:**
- Create: `src/pages/index.astro`, `src/components/ProjectCard.astro`
- Delete: `src/pages/_placeholder.astro`

- [ ] **Step 1: Write `src/components/ProjectCard.astro`**

```astro
---
interface Props {
  id: string;
  name: string;
  industry: string;
  site_region: string | null;
  site_sub_region: string | null;
  created_at: string;
}
const { id, name, industry, site_region, site_sub_region, created_at } = Astro.props;
const INDUSTRY_LABEL: Record<string, string> = { onshore_wind: '육상풍력' };
const region = [site_region, site_sub_region].filter(Boolean).join(' · ') || '지역 미지정';
---
<a href={`/projects/${id}`} class="block border border-border rounded-md bg-surface p-6 hover:border-primary">
  <h2 class="text-h2">{name}</h2>
  <p class="mt-1 text-small text-text-secondary">
    <span class="inline-block border border-border rounded px-2 py-0.5 mr-2">{INDUSTRY_LABEL[industry] ?? industry}</span>
    {region}
  </p>
  <p class="mt-3 text-small text-text-tertiary">생성 {new Date(created_at).toLocaleString('ko-KR')}</p>
</a>
```

- [ ] **Step 2: Write `src/pages/index.astro`**

```astro
---
import AppLayout from '@/layouts/AppLayout.astro';
import ProjectCard from '@/components/ProjectCard.astro';
import NewProjectModal from '@/components/NewProjectModal';
import RecentlyDeletedDrawer from '@/components/RecentlyDeletedDrawer';

const env = Astro.locals.runtime.env;
const q = Astro.url.searchParams.get('q') ?? '';
const rows = await env.DB.prepare(
  `SELECT id, name, industry, site_region, site_sub_region, created_at
   FROM projects WHERE deleted_at IS NULL
   AND (name LIKE ? OR IFNULL(site_region,'') LIKE ? OR IFNULL(site_sub_region,'') LIKE ?)
   ORDER BY created_at DESC`
).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();
const projects = rows.results as Array<{ id: string; name: string; industry: string; site_region: string | null; site_sub_region: string | null; created_at: string }>;
---
<AppLayout title="프로젝트 · eia-workbench">
  <section class="flex items-center justify-between mb-6">
    <h1 class="text-display">프로젝트</h1>
    <div class="space-x-2">
      <NewProjectModal client:load />
      <RecentlyDeletedDrawer client:idle />
    </div>
  </section>

  <form method="get" class="mb-6">
    <label class="sr-only" for="q">검색</label>
    <input id="q" name="q" type="search" value={q} placeholder="이름·지역 검색"
      class="w-full max-w-md h-9 px-3 border border-border rounded-md bg-surface" />
  </form>

  {projects.length === 0 ? (
    <div class="border border-dashed border-border rounded-md p-12 text-center">
      <p class="text-h2 text-text-secondary">첫 프로젝트를 만들어 보세요.</p>
      <p class="mt-2 text-small text-text-tertiary">우측 상단 "새 프로젝트" 버튼을 누르세요.</p>
    </div>
  ) : (
    <div class="grid gap-4 md:grid-cols-2">
      {projects.map((p) => <ProjectCard {...p} />)}
    </div>
  )}
</AppLayout>
```

- [ ] **Step 3: Delete placeholder**

Run: `rm src/pages/_placeholder.astro`

- [ ] **Step 4: Smoke run**

Run: `npm run dev`
Login, confirm `/` renders empty state with banner and two disabled buttons (will wire up in next tasks).

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/components/ProjectCard.astro
git rm src/pages/_placeholder.astro
git commit -m "feat(ui): project list page with search and empty state"
```

---

## Task 21: `NewProjectModal` (React island)

**Files:**
- Create: `src/components/NewProjectModal.tsx`, `tests/unit/new-project-modal.test.tsx` (optional — component tests require JSDOM; if the engineer prefers Playwright-only, it is covered in T26)

Because React Testing Library setup adds scope, this task relies on the e2e test in T26 to cover the component. The file is written carefully to match that e2e's selectors.

- [ ] **Step 1: Write `src/components/NewProjectModal.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import data from '@/data/administrative-divisions.json';
import { pushToast } from './toast-store';

type Region = { code: string; name: string; subs: Array<{ code: string; name: string }> };
const regions = (data as { regions: Region[] }).regions;

export default function NewProjectModal() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regionCode, setRegionCode] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  const subs = regions.find((r) => r.code === regionCode)?.subs ?? [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(form.get('name') ?? ''),
      industry: 'onshore_wind'
    };
    const reg = String(form.get('site_region_code') ?? '');
    const sub = String(form.get('site_sub_region_code') ?? '');
    if (reg) {
      body.site_region_code = reg;
      body.site_region = regions.find((r) => r.code === reg)?.name;
    }
    if (sub) {
      body.site_sub_region_code = sub;
      body.site_sub_region = regions.find((r) => r.code === reg)?.subs.find((s) => s.code === sub)?.name;
    }
    const capRaw = String(form.get('capacity_mw') ?? '');
    if (capRaw) body.capacity_mw = Number(capRaw);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    setSubmitting(false);
    if (res.status === 201) {
      const { id } = (await res.json()) as { id: string };
      window.location.href = `/projects/${id}`;
      return;
    }
    pushToast('error', '프로젝트 생성에 실패했습니다. 입력값을 다시 확인해 주세요.');
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="h-9 px-4 rounded-md bg-primary text-white hover:bg-primary-hover">
        새 프로젝트
      </button>
      <dialog ref={dialogRef} onClose={() => setOpen(false)}
              className="rounded-md p-0 backdrop:bg-black/40">
        <form method="dialog" onSubmit={handleSubmit}
              className="w-[32rem] p-6 space-y-4 bg-surface">
          <h2 className="text-h1">새 프로젝트</h2>
          <label className="block space-y-1">
            <span className="text-body font-semibold">이름 *</span>
            <input ref={firstRef} name="name" required maxLength={200}
                   className="w-full h-9 px-3 border border-border rounded-md" />
          </label>
          <div className="space-y-1">
            <span className="text-body font-semibold">업종</span>
            <p className="h-9 px-3 flex items-center border border-border rounded-md text-text-secondary bg-bg">육상풍력 (onshore_wind) · v0 고정</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-body font-semibold">시/도</span>
              <select name="site_region_code" value={regionCode}
                      onChange={(e) => setRegionCode(e.target.value)}
                      className="w-full h-9 px-3 border border-border rounded-md">
                <option value="">선택 없음</option>
                {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-body font-semibold">시/군/구</span>
              <select name="site_sub_region_code" disabled={!regionCode}
                      className="w-full h-9 px-3 border border-border rounded-md">
                <option value="">선택 없음</option>
                {subs.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-body font-semibold">용량 (MW, 선택)</span>
            <input name="capacity_mw" type="number" min={0} max={10000} step={0.1}
                   className="w-full h-9 px-3 border border-border rounded-md" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)}
                    className="h-9 px-4 rounded-md border border-border">취소</button>
            <button type="submit" disabled={submitting}
                    className="h-9 px-4 rounded-md bg-primary text-white disabled:opacity-50">
              {submitting ? '생성 중…' : '만들기'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

- [ ] **Step 2: Smoke in browser**

Run: `npm run dev` → `/` → click "새 프로젝트" → create a project.
Expected: on success, redirect to `/projects/<id>` (404 until T22 — OK).

- [ ] **Step 3: Commit**

```bash
git add src/components/NewProjectModal.tsx
git commit -m "feat(ui): new project modal with region cascading select"
```

---

## Task 22: `/projects/[id]` detail page (with tabs)

**Files:**
- Create: `src/pages/projects/[id].astro`, `src/components/DisabledTab.tsx`

- [ ] **Step 1: Write `src/components/DisabledTab.tsx`**

```tsx
import { useState } from 'react';

export default function DisabledTab({ label, tooltip }: { label: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" aria-disabled="true"
              onClick={() => setShow((s) => !s)}
              onBlur={() => setShow(false)}
              className="h-9 px-4 border-b-2 border-transparent text-text-tertiary cursor-not-allowed">
        {label}
      </button>
      {show && (
        <span role="tooltip"
              className="absolute left-0 top-full mt-1 z-10 w-64 p-2 rounded-md border border-border bg-surface text-small text-text-secondary shadow-sm">
          {tooltip}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Write `src/pages/projects/[id].astro`**

```astro
---
import AppLayout from '@/layouts/AppLayout.astro';
import UploadDropzone from '@/components/UploadDropzone';
import FileList from '@/components/FileList';
import DisabledTab from '@/components/DisabledTab';

const env = Astro.locals.runtime.env;
const id = Astro.params.id!;
const project = await env.DB.prepare(
  `SELECT id, name, industry, site_region, site_sub_region, capacity_mw, created_at
   FROM projects WHERE id = ? AND deleted_at IS NULL`
).bind(id).first<{
  id: string; name: string; industry: string;
  site_region: string | null; site_sub_region: string | null;
  capacity_mw: number | null; created_at: string;
}>();
if (!project) return new Response('not found', { status: 404 });

const quotaRow = await env.DB.prepare(
  `SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS n FROM uploads
   WHERE project_id = ? AND deleted_at IS NULL`
).bind(id).first<{ total: number; n: number }>();
const totalBytes = quotaRow?.total ?? 0;
const count = quotaRow?.n ?? 0;

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_FILES = 30;
const region = [project.site_region, project.site_sub_region].filter(Boolean).join(' · ') || '지역 미지정';
---
<AppLayout title={`${project.name} · eia-workbench`}>
  <nav class="text-small text-text-tertiary mb-3">
    <a href="/" class="hover:text-text-primary">← 프로젝트 목록</a>
  </nav>
  <header class="mb-6">
    <h1 class="text-display">{project.name}</h1>
    <p class="mt-2 text-small text-text-secondary">
      <span class="inline-block border border-border rounded px-2 py-0.5 mr-2">육상풍력</span>
      {region}
      {project.capacity_mw != null && <span class="ml-2">· {project.capacity_mw} MW</span>}
      <span class="ml-2">· 생성 {new Date(project.created_at).toLocaleString('ko-KR')}</span>
    </p>
  </header>

  <div role="tablist" class="flex gap-1 border-b border-border mb-6">
    <button type="button" role="tab" aria-selected="true"
            class="h-9 px-4 border-b-2 border-primary text-primary">자료</button>
    <DisabledTab client:load label="스코핑" tooltip="v0 범위 밖. 로드맵: feature/scoping-assistant" />
    <DisabledTab client:load label="초안점검" tooltip="v0 범위 밖. 로드맵: feature/draft-checker" />
    <DisabledTab client:load label="의견대응" tooltip="v0 범위 밖. 로드맵: feature/opinion-response" />
  </div>

  <section class="space-y-4">
    <div class="text-small text-text-secondary">
      사용량 <strong>{(totalBytes / (1024 * 1024)).toFixed(1)}</strong> MB / 300 MB ·
      <strong>{count}</strong> / {MAX_FILES} 파일
    </div>
    <UploadDropzone client:load projectId={project.id} />
    <FileList client:load projectId={project.id} />
    <p class="text-small text-text-tertiary border-t border-border pt-4">
      업로드 문서는 귀하의 자료입니다. EIASS 원문 재호스팅 금지. 본 도구는 검토 보조이며 현지조사를 대체하지 않습니다.
    </p>
  </section>
</AppLayout>
```

- [ ] **Step 3: Smoke build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/ src/components/DisabledTab.tsx
git commit -m "feat(ui): project detail page with aria-disabled tabs"
```

---

## Task 23: `UploadDropzone` + `FileList` (React islands)

**Files:**
- Create: `src/components/UploadDropzone.tsx`, `src/components/FileList.tsx`

- [ ] **Step 1: Write `src/components/UploadDropzone.tsx`**

```tsx
import { useRef, useState } from 'react';
import { pushToast } from './toast-store';

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const MAX_BYTES = 30 * 1024 * 1024;

export default function UploadDropzone({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.name.match(/\.(hwp|hwpx)$/i)) {
      pushToast('warn', 'HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.');
      return;
    }
    if (!ALLOWED.has(file.type)) {
      pushToast('error', 'PDF / DOCX / TXT만 지원합니다.');
      return;
    }
    if (file.size > MAX_BYTES) {
      pushToast('error', '파일당 30MB 한도를 초과했습니다.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/uploads`, { method: 'POST', body: form });
    setBusy(false);
    if (res.status === 201) {
      pushToast('info', `업로드 완료: ${file.name}`);
      window.dispatchEvent(new CustomEvent('uploads:refresh'));
      return;
    }
    if (res.status === 409) {
      const j = (await res.json()) as { original_name: string; created_at: string };
      pushToast('warn', `이미 업로드됨: ${j.original_name} · ${new Date(j.created_at).toLocaleString('ko-KR')}`);
      return;
    }
    if (res.status === 413) {
      pushToast('error', '프로젝트 한도(300MB 또는 30파일)에 도달했습니다.');
      return;
    }
    if (res.status === 415) {
      pushToast('error', '파일 형식 검증에 실패했습니다.');
      return;
    }
    pushToast('error', `업로드 실패 (HTTP ${res.status}).`);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={async (e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) await upload(f);
      }}
      className="border-2 border-dashed border-border rounded-md p-8 text-center bg-surface"
      role="region" aria-label="파일 업로드 영역"
    >
      <p class-name="text-body">
        PDF / DOCX / TXT만 지원합니다.
        HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.{' '}
        <a href="https://www.hancomoffice.com/" target="_blank" rel="noreferrer"
           className="text-primary underline">온라인 변환 안내 ↗</a>
      </p>
      <p className="text-small text-text-tertiary mt-1">드래그하여 놓거나 버튼으로 선택.</p>
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="mt-4 h-9 px-4 rounded-md bg-primary text-white disabled:opacity-50">
        {busy ? '업로드 중…' : '파일 선택'}
      </button>
      <input ref={inputRef} type="file" hidden multiple
             accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
             onChange={async (e) => {
               for (const f of Array.from(e.target.files ?? [])) await upload(f);
               if (inputRef.current) inputRef.current.value = '';
             }} />
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/FileList.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { pushToast } from './toast-store';

type Upload = { id: string; original_name: string; mime: string; size_bytes: number; created_at: string };

export default function FileList({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Upload[]>([]);
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/uploads`);
    if (!res.ok) return;
    const j = (await res.json()) as { uploads: Upload[] };
    setItems(j.uploads);
  }, [projectId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener('uploads:refresh', h);
    return () => window.removeEventListener('uploads:refresh', h);
  }, [refresh]);

  async function del(id: string) {
    const res = await fetch(`/api/projects/${projectId}/uploads/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      pushToast('info', '삭제했습니다. 30일 내 "최근 삭제"에서 복구 가능.');
      refresh();
    } else {
      pushToast('error', `삭제 실패 (HTTP ${res.status}).`);
    }
  }

  if (items.length === 0) {
    return <p className="text-small text-text-tertiary">업로드된 파일이 없습니다.</p>;
  }

  return (
    <table className="w-full border border-border rounded-md overflow-hidden">
      <thead className="text-small text-text-secondary bg-bg">
        <tr>
          <th className="text-left px-4 py-2">이름</th>
          <th className="text-left px-4 py-2">크기</th>
          <th className="text-left px-4 py-2">업로드</th>
          <th className="text-left px-4 py-2 sr-only">동작</th>
        </tr>
      </thead>
      <tbody>
        {items.map((u) => (
          <tr key={u.id} className="border-t border-border">
            <td className="px-4 py-2">{u.original_name}</td>
            <td className="px-4 py-2 text-small text-text-secondary">{(u.size_bytes / 1024).toFixed(0)} KB</td>
            <td className="px-4 py-2 text-small text-text-tertiary">{new Date(u.created_at).toLocaleString('ko-KR')}</td>
            <td className="px-4 py-2 text-right">
              <button onClick={() => del(u.id)} aria-label={`${u.original_name} 삭제`}
                      className="text-small text-danger hover:underline">삭제</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UploadDropzone.tsx src/components/FileList.tsx
git commit -m "feat(ui): upload dropzone and file list islands"
```

---

## Task 24: `RecentlyDeletedDrawer`

**Files:**
- Create: `src/pages/api/deleted.ts`, `src/components/RecentlyDeletedDrawer.tsx`

- [ ] **Step 1: Write `src/pages/api/deleted.ts`**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projects = await env.DB.prepare(
    `SELECT id, name, deleted_at FROM projects
     WHERE deleted_at IS NOT NULL AND deleted_at >= datetime('now','-30 days')
     ORDER BY deleted_at DESC`
  ).all();
  const uploads = await env.DB.prepare(
    `SELECT id, project_id, original_name, deleted_at FROM uploads
     WHERE deleted_at IS NOT NULL AND deleted_at >= datetime('now','-30 days')
     ORDER BY deleted_at DESC`
  ).all();
  logger.info({ route: '/api/deleted', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ projects: projects.results, uploads: uploads.results });
};
```

- [ ] **Step 2: Write `src/components/RecentlyDeletedDrawer.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { pushToast } from './toast-store';

type DelP = { id: string; name: string; deleted_at: string };
type DelU = { id: string; project_id: string; original_name: string; deleted_at: string };

export default function RecentlyDeletedDrawer() {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<DelP[]>([]);
  const [u, setU] = useState<DelU[]>([]);

  async function refresh() {
    const r = await fetch('/api/deleted');
    if (!r.ok) return;
    const j = (await r.json()) as { projects: DelP[]; uploads: DelU[] };
    setP(j.projects); setU(j.uploads);
  }

  useEffect(() => { if (open) refresh(); }, [open]);

  function daysLeft(ts: string): number {
    const deleted = new Date(ts).getTime();
    const expires = deleted + 30 * 24 * 3600 * 1000;
    return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 3600 * 1000)));
  }

  async function restoreProject(id: string) {
    const r = await fetch(`/api/projects/${id}/restore`, { method: 'PATCH', headers: { 'content-type': 'application/json' } });
    if (r.status === 204) { pushToast('info', '프로젝트를 복구했습니다.'); refresh(); }
    else pushToast('error', `복구 실패 (HTTP ${r.status}).`);
  }
  async function restoreUpload(pid: string, uid: string) {
    const r = await fetch(`/api/projects/${pid}/uploads/${uid}/restore`, { method: 'PATCH', headers: { 'content-type': 'application/json' } });
    if (r.status === 204) { pushToast('info', '파일을 복구했습니다.'); refresh(); }
    else pushToast('error', `복구 실패 (HTTP ${r.status}).`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="h-9 px-4 rounded-md border border-border text-text-secondary">
        최근 삭제
      </button>
      {open && (
        <div role="dialog" aria-label="최근 삭제"
             className="fixed inset-0 z-40 bg-black/40"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <aside className="absolute right-0 top-0 h-full w-96 bg-surface border-l border-border p-6 overflow-y-auto">
            <h2 className="text-h1 mb-4">최근 삭제 (30일 내)</h2>

            <section className="mb-6">
              <h3 className="text-h2 mb-2">프로젝트</h3>
              {p.length === 0 ? <p className="text-small text-text-tertiary">없음.</p> : p.map((x) => (
                <div key={x.id} className="flex items-center justify-between border-b border-border py-2">
                  <div>
                    <p>{x.name}</p>
                    <p className="text-small text-text-tertiary">D-{daysLeft(x.deleted_at)} 남음</p>
                  </div>
                  <button onClick={() => restoreProject(x.id)}
                          className="text-small text-primary hover:underline">되돌리기</button>
                </div>
              ))}
            </section>

            <section>
              <h3 className="text-h2 mb-2">파일</h3>
              {u.length === 0 ? <p className="text-small text-text-tertiary">없음.</p> : u.map((x) => (
                <div key={x.id} className="flex items-center justify-between border-b border-border py-2">
                  <div>
                    <p>{x.original_name}</p>
                    <p className="text-small text-text-tertiary">D-{daysLeft(x.deleted_at)} 남음</p>
                  </div>
                  <button onClick={() => restoreUpload(x.project_id, x.id)}
                          className="text-small text-primary hover:underline">되돌리기</button>
                </div>
              ))}
            </section>

            <button onClick={() => setOpen(false)}
                    className="mt-6 h-9 px-4 rounded-md border border-border">닫기</button>
          </aside>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/deleted.ts src/components/RecentlyDeletedDrawer.tsx
git commit -m "feat(ui): recently-deleted drawer with project/upload restore"
```

---

## Task 25: Cron worker — 30-day hard delete

**Files:**
- Create: `workers/cron-cleanup.ts`, `tests/unit/cron-cleanup.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runCleanup } from '@/../workers/cron-cleanup';

function setup(rowCount: number, r2Keys: string[] = []) {
  const deletes: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.startsWith('SELECT COUNT')) return ({ n: rowCount } as unknown) as T;
              return null;
            },
            async all<T>() {
              if (sql.startsWith('SELECT r2_key')) {
                return ({ results: r2Keys.map((k) => ({ r2_key: k })) as T[] });
              }
              return { results: [] as T[] };
            },
            async run() {
              if (sql.startsWith('DELETE')) deletes.push(sql);
              return { success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  const r2Deleted: string[] = [];
  const r2 = { async delete(k: string) { r2Deleted.push(k); } } as unknown as R2Bucket;
  return { db, r2, deletes, r2Deleted };
}

describe('runCleanup', () => {
  it('aborts and alerts when row count exceeds ceiling', async () => {
    const s = setup(1500);
    const logs: unknown[] = [];
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as Env, (e) => logs.push(e));
    expect(s.deletes.length).toBe(0);
    expect(logs.some((l) => JSON.stringify(l).includes('ceiling'))).toBe(true);
  });
  it('deletes r2 objects then d1 rows', async () => {
    const s = setup(2, ['projects/p1/k1', 'projects/p1/k2']);
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as Env, () => {});
    expect(s.r2Deleted).toEqual(['projects/p1/k1', 'projects/p1/k2']);
    expect(s.deletes.length).toBeGreaterThanOrEqual(2);
  });
  it('skips r2 delete when no uploads are due', async () => {
    const s = setup(1, []);
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as Env, () => {});
    expect(s.r2Deleted.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm test -- tests/unit/cron-cleanup.test.ts`
Expected: module not found.

- [ ] **Step 3: Write `workers/cron-cleanup.ts`**

```ts
import { CRON_HARD_DELETE_ROW_CEILING } from '@/lib/constants';

type Alert = (e: Record<string, unknown>) => void;

export async function runCleanup(env: Env, alert: Alert): Promise<void> {
  // Count rows due for hard-delete across both tables.
  const pCount = (await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).first<{ n: number }>())?.n ?? 0;
  const uCount = (await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).first<{ n: number }>())?.n ?? 0;
  const total = pCount + uCount;
  if (total > CRON_HARD_DELETE_ROW_CEILING) {
    alert({ level: 'error', reason: 'cron_row_ceiling_exceeded', total });
    return;
  }

  // 1. Delete R2 objects for uploads due.
  const dueKeys = await env.DB.prepare(
    `SELECT r2_key FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).all<{ r2_key: string }>();
  for (const row of dueKeys.results ?? []) {
    await env.UPLOADS.delete(row.r2_key).catch(() => {});
  }

  // 2. Delete D1 rows.
  await env.DB.prepare(
    `DELETE FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).run();
  await env.DB.prepare(
    `DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).run();

  // 3. Purge old login_attempts (>30 days) to keep table bounded.
  await env.DB.prepare(
    `DELETE FROM login_attempts WHERE ts < datetime('now','-30 days')`
  ).run();
}

export default {
  async scheduled(_event: ScheduledController, env: Env) {
    await runCleanup(env, (e) => console.log(JSON.stringify(e)));
  }
};
```

- [ ] **Step 4: Wire the scheduled export**

The `astro-cloudflare` adapter generates the fetch handler; for the scheduled trigger, we ship a sibling Worker bundle. Add to `wrangler.toml`:

```toml
# Append to existing wrangler.toml
[[services]]
binding = "CLEANUP"
service = "eia-workbench-cleanup"

# Second project config at workers/cleanup.wrangler.toml
```

Create `workers/cleanup.wrangler.toml`:

```toml
name = "eia-workbench-cleanup"
main = "workers/cron-cleanup.ts"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "eia-workbench-dev"
database_id = "local-placeholder"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "eia-workbench-uploads-dev"

[triggers]
crons = ["0 18 * * *"]  # 03:00 KST
```

- [ ] **Step 5: Run — pass**

Run: `npm test -- tests/unit/cron-cleanup.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add workers/ tests/unit/cron-cleanup.test.ts wrangler.toml
git commit -m "feat(cron): 30-day hard-delete worker with row ceiling guard"
```

---

## Task 26: E2E — CRUD happy path

**Files:**
- Create: `tests/e2e/crud-happy.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
```

- [ ] **Step 2: Write `tests/e2e/crud-happy.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PASSWORD = process.env.E2E_APP_PASSWORD ?? 'change-me-long-random';

test('login → create project → upload PDF → delete → restore', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  // Cloudflare test keys auto-pass — no manual Turnstile interaction needed.
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  await expect(page.getByRole('status')).toContainText('v0 파일럿');

  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', '강원 풍력 1단지');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.selectOption('select[name="site_sub_region_code"]', '42750');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  // Upload a tiny PDF fixture.
  const pdf = Buffer.from('%PDF-1.4\n%EOF\n');
  await page.setInputFiles('input[type="file"]', {
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: pdf
  });
  await expect(page.getByText('업로드 완료: sample.pdf')).toBeVisible();
  await expect(page.getByText('sample.pdf')).toBeVisible();

  // Delete file.
  await page.getByRole('button', { name: /sample\.pdf 삭제/ }).click();
  await expect(page.getByText('삭제했습니다')).toBeVisible();

  // Restore from drawer.
  await page.goto('/');
  await page.getByRole('button', { name: '최근 삭제' }).click();
  await page.getByRole('button', { name: '되돌리기' }).first().click();
  await expect(page.getByText('복구했습니다')).toBeVisible();
});
```

- [ ] **Step 3: Install Playwright browsers**

Run: `npx playwright install chromium`

- [ ] **Step 4: Run e2e**

Prereq: `.dev.vars` set, `npm run db:migrate:local` done.
Run: `E2E_APP_PASSWORD="$(grep APP_PASSWORD .dev.vars | cut -d= -f2)" npm run test:e2e -- tests/e2e/crud-happy.spec.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/crud-happy.spec.ts
git commit -m "test(e2e): crud happy path — login, create, upload, delete, restore"
```

---

## Task 27: E2E — HWP rejection + quota exceeded

**Files:**
- Create: `tests/e2e/hwp-reject.spec.ts`, `tests/e2e/quota-exceeded.spec.ts`

- [ ] **Step 1: Write `tests/e2e/hwp-reject.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const PASSWORD = process.env.E2E_APP_PASSWORD ?? 'change-me-long-random';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
});

test('drop zone rejects HWP with Hancom guidance', async ({ page }) => {
  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', 'HWP 거부 테스트');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  // Show the guidance in the dropzone.
  await expect(page.getByText(/HWP는 한컴오피스에서 PDF로 저장/)).toBeVisible();
  await expect(page.getByRole('link', { name: /온라인 변환 안내/ })).toHaveAttribute('href', 'https://www.hancomoffice.com/');

  // Attempt to upload an .hwp file.
  await page.setInputFiles('input[type="file"]', {
    name: 'legacy.hwp',
    mimeType: 'application/x-hwp',
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0])
  });
  await expect(page.getByText(/HWP는 한컴오피스에서 PDF로 저장/)).toBeVisible();
});
```

- [ ] **Step 2: Write `tests/e2e/quota-exceeded.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const PASSWORD = process.env.E2E_APP_PASSWORD ?? 'change-me-long-random';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
});

test('rejects >30MB file with clear error toast', async ({ page }) => {
  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', '용량 한도 테스트');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  const big = Buffer.alloc(31 * 1024 * 1024);
  big.write('%PDF-1.4', 0);
  await page.setInputFiles('input[type="file"]', {
    name: 'huge.pdf', mimeType: 'application/pdf', buffer: big
  });
  await expect(page.getByText(/30MB 한도를 초과/)).toBeVisible();
});
```

- [ ] **Step 3: Run both**

Run: `E2E_APP_PASSWORD="$(grep APP_PASSWORD .dev.vars | cut -d= -f2)" npm run test:e2e -- tests/e2e/hwp-reject.spec.ts tests/e2e/quota-exceeded.spec.ts`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/hwp-reject.spec.ts tests/e2e/quota-exceeded.spec.ts
git commit -m "test(e2e): hwp rejection and quota-exceeded scenarios"
```

---

## Task 28: Assertion-grep + axe lint + CI workflow

**Files:**
- Create: `scripts/assertion-grep.sh`, `.github/workflows/ci.yml`, `tests/e2e/axe-smoke.spec.ts`

- [ ] **Step 1: Write `scripts/assertion-grep.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

PATTERN='환경영향평가\s*대상입니다|협의\s*통과|승인됨|법적으로\s*문제\s*없|자동.*(완료|작성).*(안전|문제없)'
PAID_KEYS='ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY'

fail=0
for dir in src workers tests/e2e; do
  if grep -E -rn "$PATTERN" "$dir" 2>/dev/null; then
    echo "::error::Forbidden legal assertion found in $dir"
    fail=1
  fi
done
if grep -E -rn "$PAID_KEYS" src workers 2>/dev/null; then
  echo "::error::Paid LLM key reference found (violates CLAUDE.md §2-2 / §9.2)"
  fail=1
fi
exit $fail
```

- [ ] **Step 2: Write `tests/e2e/axe-smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const PASSWORD = process.env.E2E_APP_PASSWORD ?? 'change-me-long-random';

test('login page passes axe smoke', async ({ page }) => {
  await page.goto('/login');
  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true });
});

test('project list passes axe smoke', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true });
});
```

- [ ] **Step 3: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: assertion-grep
        run: bash scripts/assertion-grep.sh
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: apply migrations (local D1)
        run: npx wrangler d1 migrations apply DB --local
      - run: npx playwright install --with-deps chromium
      - name: e2e
        env:
          E2E_APP_PASSWORD: ${{ secrets.E2E_APP_PASSWORD || 'change-me-long-random' }}
        run: npm run test:e2e
      - run: npm run build
```

- [ ] **Step 4: Run locally**

Run:
```bash
chmod +x scripts/assertion-grep.sh
npm run assertion-grep
npm run typecheck
npm run lint
npm test
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/assertion-grep.sh .github/workflows/ci.yml tests/e2e/axe-smoke.spec.ts
git commit -m "chore(ci): assertion-grep, axe smoke, full ci workflow"
```

---

## Self-Review Checklist (engineer runs before declaring done)

- [ ] Every route in §3 of the spec has a corresponding task (0 = T12, A = T20, B = T14+T21, C = T17+T23, D = T18+T23, E = T15+T18+T24, F = T22, G = T12).
- [ ] Schema in T3 exactly matches spec §4 (columns, CHECK, partial unique index).
- [ ] All 12 security items from spec §10 are covered:
  - 10.1 timing-safe + rate-limit + 300ms floor + JWT + cookie flags → T8, T9, T10, T12
  - 10.2 magic bytes + random R2 key + size limits → T16, T17
  - 10.3 Origin check + GET no side effects → T11
  - 10.4 CSP + headers + Content-Disposition → T11 (download in v0 scope deferred, but headers applied)
  - 10.5 PII-safe logger → T6
  - 10.6 Zod length caps → T5
  - 10.7 Cron ceiling guard → T25
  - 10.8 Workers Secrets → T2 `.dev.vars.example` documents
  - 10.9 Download disposition / malware gating → README note (add in T28 sweep if missing)
- [ ] All 7 rows in spec §11 risk table have at least one implementation or test:
  - ① ② → `detectLegalAssertion` + assertion-grep + e2e visible copy (T7, T28)
  - ③ → UI copy + `data/samples/private` ignored (already ignored; verify in T28)
  - ⑤ → noted as "next feature"; no contradiction in v0 code
  - ⑥ → `assertion-grep.sh` blocks paid keys (T28)
  - ⑦ → `PilotWarningBanner` on every page (T19)
- [ ] No "similar to task N" stubs, no TODO, no TBD.
- [ ] Method/type names match across tasks (`buildR2Key`, `validateMagicBytes`, `detectLegalAssertion`, `buildSessionCookie`, `parseSessionCookie`, `buildLogoutCookie`, `signJwt`, `verifyJwt`, `timingSafeEqual`, `recordAttempt`, `isBlocked`, `pushToast`, `runCleanup`).

---

## Execution Handoff

Plan complete and saved to `docs/plans/feature-project-shell.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
