import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// T25 scoping-unit-toggle-v2:
//   입력 단위를 ha 로 바꾸고 0.8 ha 를 넣으면 POST body 의 site_area_m2 가 8000 으로
//   정규화되어야 한다. 또 site_area_input_unit 은 'ha' 로 전송되어야 한다.
//   (정규화 로직은 src/features/scoping/units.ts 의 normalizeAreaToSqm: 1 ha = 10_000㎡)

test('scoping unit toggle — ha 입력이 POST body 에서 ㎡ 로 정규화된다', async ({ page }) => {
  await loginViaUi(page);

  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('unit toggle');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}\/scoping/);

  // 사업부지 면적 입력 + 단위를 ha 로 변경
  await page.getByLabel('사업부지 면적', { exact: false }).first().fill('0.8');
  await page.getByLabel('사업부지 면적 단위').selectOption('ha');
  await page.getByLabel('용도지역').selectOption('agricultural_forestry');

  // POST request 감시
  const requestPromise = page.waitForRequest(
    (req) =>
      req.url().includes('/api/projects/') &&
      req.url().endsWith('/scoping') &&
      req.method() === 'POST'
  );

  await page.getByRole('button', { name: '검토 실행', exact: true }).click();

  const req = await requestPromise;
  const body = req.postDataJSON() as {
    site_area_m2: number;
    site_area_input_unit: string;
    land_use_zone: string;
  };
  expect(body.site_area_m2).toBe(8000);
  expect(body.site_area_input_unit).toBe('ha');
  expect(body.land_use_zone).toBe('agricultural_forestry');

  // 결과가 실제로 렌더되는지도 확인 (정규화 후 8000㎡ = agri_forestry 7500 임계 넘김)
  await expect(
    page.locator('section[aria-label="발동된 규칙"]').getByRole('heading', {
      name: '소규모 환경영향평가 — 농림/자연환경보전/생산관리 3존 번들'
    })
  ).toBeVisible();
});
