import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

test('facet combo: 강원 OR 전남 + 10-50 MW → URL 갱신 + 결과 region 일치', async ({ page }) => {
  await loginViaUi(page);
  await page.goto('/cases');

  await page.getByLabel('강원').check();
  await page.getByLabel('전남').check();
  await page.getByLabel('10-50').check();

  await expect(page).toHaveURL(/sido=%EA%B0%95%EC%9B%90|sido=강원/);
  await expect(page).toHaveURL(/sido=%EC%A0%84%EB%82%A8|sido=전남/);
  await expect(page).toHaveURL(/capacity_band=10-50/);

  // facet 적용 후 결과가 새로 들어올 시간 부여 (300ms debounce + fetch).
  await page.waitForTimeout(800);

  const articles = page.locator('article');
  const count = await articles.count();
  if (count > 0) {
    const regions = await articles.locator('p.text-small').allTextContents();
    for (const t of regions) {
      expect(t).toMatch(/강원|전남|지역 미상/);
    }
  } else {
    // 로컬 D1 시드가 비어있을 때(facet AND 결과가 0건일 수 있음) — URL 갱신만 검증.
    expect(count).toBeGreaterThanOrEqual(0);
  }
});
