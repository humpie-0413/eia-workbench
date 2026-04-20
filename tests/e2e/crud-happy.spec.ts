import { test, expect } from '@playwright/test';

const PASSWORD = process.env['E2E_APP_PASSWORD'] ?? 'change-me-long-random';

test('login → create project → upload PDF → delete → restore', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  await expect(page.getByRole('status')).toContainText('v0 파일럿');

  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', '강원 풍력 1단지');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.selectOption('select[name="site_sub_region_code"]', '42750');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  const pdf = Buffer.from('%PDF-1.4\n%EOF\n');
  await page.setInputFiles('input[type="file"]', {
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });
  await expect(page.getByText('업로드 완료: sample.pdf')).toBeVisible();
  await expect(page.getByText('sample.pdf')).toBeVisible();

  await page.getByRole('button', { name: /sample\.pdf 삭제/ }).click();
  await expect(page.getByText('삭제했습니다')).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: '최근 삭제' }).click();
  await page.getByRole('button', { name: '되돌리기' }).first().click();
  await expect(page.getByText('복구했습니다')).toBeVisible();
});
