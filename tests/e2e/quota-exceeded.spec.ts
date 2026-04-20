import { test, expect } from '@playwright/test';

const PASSWORD = process.env['E2E_APP_PASSWORD'] ?? 'change-me-long-random';

// NOTE: This test requires a running dev server AND:
//   - .dev.vars TURNSTILE_SECRET_KEY set to Cloudflare test secret (1x0000000000000000000000000000000AA)
//   - TURNSTILE_SITE_KEY set to test site key (1x00000000000000000000AA)
//   - APP_PASSWORD set; E2E_APP_PASSWORD env var must match it
//   - Fresh local D1 (npm run db:migrate:local) — this test does NOT clean up after itself.

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
});

// DEVIATION from plan spec §T27:
// - Spec assumed /30MB 한도를 초과/ would come from a server-side HTTP 413 response.
//   The actual UploadDropzone checks file.size > MAX_BYTES (30 MB) client-side BEFORE any fetch.
//   The exact pushToast message is: '파일당 30MB 한도를 초과했습니다.'
//   Regex adapted: /30MB 한도를 초과/ still matches the actual string — no change to the regex needed.
//   The toast appears immediately without a network round-trip.
// - The file is a PDF stub (starts with '%PDF-1.4') as in the plan spec, but the check is purely
//   by file.size, so the content does not affect the rejection path.
test('rejects >30MB file with clear error toast', async ({ page }) => {
  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', '용량 한도 테스트');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  // Build a 31 MB buffer that starts with the PDF magic bytes.
  // UploadDropzone checks file.size > 30 * 1024 * 1024 before fetching.
  const big = Buffer.alloc(31 * 1024 * 1024);
  big.write('%PDF-1.4', 0, 'ascii');

  await page.setInputFiles('input[type="file"]', {
    name: 'huge.pdf',
    mimeType: 'application/pdf',
    buffer: big,
  });

  // Toast with kind="error" — exact message: '파일당 30MB 한도를 초과했습니다.'
  // Regex /30MB 한도를 초과/ matches this verbatim (no change from spec).
  await expect(
    page.getByRole('alert').filter({ hasText: /30MB 한도를 초과/ })
  ).toBeVisible();
});
