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
// - Spec expected a static visible text assert of /HWP는 한컴오피스에서 PDF로 저장/.
//   The actual UploadDropzone renders exactly: "HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요."
//   as static p-tag text, so the regex /한컴오피스에서 PDF로 저장/ still matches it without file upload.
// - The Hancom link href and text "온라인 변환 안내 ↗" match the spec exactly.
// - After HWP setInputFiles, the rejection is client-side (filename extension check).
//   The component calls pushToast('warn', 'HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.')
//   which renders as a role="alert" toast — NOT a repeated static text node.
//   Spec said "re-assert guidance text stays visible"; the static p-tag text is always present,
//   so the assertion `toBeVisible()` on the p-tag text naturally holds.
//   The spec's additional intent (toast appears) is tested via the role="alert" check below.
test('drop zone rejects HWP with Hancom guidance', async ({ page }) => {
  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', 'HWP 거부 테스트');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  // Static guidance text is always visible in the dropzone paragraph
  await expect(
    page.getByText(/한컴오피스에서 PDF로 저장 후 업로드해 주세요/)
  ).toBeVisible();

  // Hancom link — href and accessible name match the actual UploadDropzone
  // (spec expected href 'https://www.hancomoffice.com/' and name /온라인 변환 안내/ — both correct)
  await expect(
    page.getByRole('link', { name: /온라인 변환 안내/ })
  ).toHaveAttribute('href', 'https://www.hancomoffice.com/');

  // Attempt to upload a .hwp file via setInputFiles
  // UploadDropzone checks file.name against /\.(hwp|hwpx)$/i before MIME or size checks.
  // Rejection is client-side — no network request is made.
  await page.setInputFiles('input[type="file"]', {
    name: 'legacy.hwp',
    mimeType: 'application/x-hwp',
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
  });

  // Toast with kind="warn" appears via role="alert" containing the rejection message.
  // Text is 'HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.' (exact pushToast argument).
  await expect(
    page.getByRole('alert').filter({ hasText: /HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요/ })
  ).toBeVisible();

  // Static guidance text remains visible after rejection (dropzone state unchanged)
  await expect(
    page.getByText(/한컴오피스에서 PDF로 저장 후 업로드해 주세요/)
  ).toBeVisible();
});
