import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// T27-b scoping-history:
//   검토를 한 번 실행하면 RunHistoryList 에 항목 1개가 뜨고, 그 항목을 클릭하면
//   해당 run 이 결과 패널에 다시 로드되어야 한다 (scoping:load-run 이벤트 동작).

test('run history — 실행 후 히스토리에 등록, 클릭 시 재로드', async ({ page }) => {
  await loginViaUi(page);

  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('history');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}\/scoping/);

  const history = page.locator('section[aria-label="최근 검토 실행"]');
  await expect(history.getByText('아직 실행 기록이 없습니다.')).toBeVisible();

  // 첫 실행
  await page.getByLabel('사업부지 면적', { exact: false }).first().fill('8000');
  await page.getByLabel('용도지역').selectOption('agricultural_forestry');
  await page.getByRole('button', { name: '검토 실행', exact: true }).click();

  // 결과 렌더 대기
  await expect(page.getByTestId('rule-pack-version')).toBeVisible();

  // 히스토리에 rule pack version 라벨이 표시되어야 함
  await expect(history.getByText('onshore_wind/v2.2026-04-23').first()).toBeVisible();

  const loadButton = history.locator('button[aria-label$="실행 불러오기"]').first();
  await expect(loadButton).toBeVisible();

  // 결과 패널이 비워졌을 때도 클릭으로 재로드되는지 확인 — 먼저 결과 DOM snapshot 저장
  const resultsBefore = await page
    .locator('section[aria-label="검토 결과"]')
    .locator('[data-testid="rule-pack-version"]')
    .innerText();

  await loadButton.click();

  // load-run 이벤트 후에도 동일 결과가 렌더되어 있어야 함
  await expect(page.getByTestId('rule-pack-version')).toHaveText(resultsBefore);
  await expect(
    page
      .locator('section[aria-label="발동된 규칙"]')
      .getByRole('heading', {
        name: '소규모 환경영향평가 — 농림/자연환경보전/생산관리 3존 번들'
      })
  ).toBeVisible();
});
