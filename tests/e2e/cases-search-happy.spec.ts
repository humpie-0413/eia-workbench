import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

test('사례 검색 happy path: 강원 풍력 → 카드 ≥ 1 + EIASS 원문 링크', async ({ page }) => {
  await loginViaUi(page);
  await page.goto('/cases');

  await page.getByPlaceholder(/사업명·지역명/).fill('TESTSEED');
  await page.getByLabel('강원').check();

  await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

  await page.locator('article').first().click();

  // CasePreviewPane renders <a> (not <button>) for the EIASS deep-link.
  await expect(page.getByRole('link', { name: /EIASS 원문 열기/ })).toBeVisible();
});
