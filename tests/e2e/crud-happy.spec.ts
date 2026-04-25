import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// NOTE: This test requires a running dev server AND:
//   - .dev.vars TURNSTILE_SECRET_KEY set to Cloudflare test secret (1x0000000000000000000000000000000AA)
//   - TURNSTILE_SITE_KEY set to test site key (1x00000000000000000000AA)
//   - APP_PASSWORD set; E2E_APP_PASSWORD env var must match it
//   - Fresh local D1 (npm run db:migrate:local) — this test does NOT clean up after itself.

test('login → create project → upload PDF → delete → restore', async ({ page }) => {
  await loginViaUi(page);

  await expect(page.getByRole('status')).toContainText('v0 파일럿');

  // NewProjectModal is client:load; retry the open click until the dialog's
  // name input becomes visible — matches the pattern in axe-smoke.spec.ts.
  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('강원 풍력 1단지');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.selectOption('select[name="site_sub_region_code"]', '42750');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  const pdf = Buffer.from('%PDF-1.4\n%EOF\n');
  // UploadDropzone (client:load) attaches onChange at hydration. Under parallel worker
  // load setInputFiles can fire before React hooks the hidden input — the file gets set
  // but no POST fires. Retry setInputFiles inside toPass, using waitForRequest as the
  // deterministic "upload actually started" signal. Safe against double-upload: iteration
  // 1's onChange is dropped on the floor if React wasn't ready (React doesn't replay
  // events at hydration), so only the post-hydration iteration triggers a POST.
  await expect(async () => {
    const reqPromise = page.waitForRequest(
      (req) => req.url().includes('/uploads') && req.method() === 'POST',
      { timeout: 3000 }
    );
    await page.setInputFiles('input[type="file"]', {
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: pdf
    });
    await reqPromise;
  }).toPass({ timeout: 20_000 });
  // Cell is the permanent DB-backed state; toast "업로드 완료" is ephemeral and intentionally dropped.
  await expect(page.getByRole('cell', { name: 'sample.pdf', exact: true })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole('button', { name: /sample\.pdf 삭제/ }).click();
  await expect(page.getByText('삭제했습니다')).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: '최근 삭제' }).click();
  await page.getByRole('button', { name: '되돌리기' }).first().click();
  await expect(page.getByText('복구했습니다')).toBeVisible();
});
