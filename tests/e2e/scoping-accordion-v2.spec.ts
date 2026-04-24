import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// T26 scoping-accordion-v2:
//   스킵된 규칙 섹션은 <details> 로 기본 접힘 상태여야 하고,
//   summary 를 클릭해 펼쳐야 skip_reason 문구가 보여야 한다.
//   한 번 더 클릭하면 접히고 문구가 다시 숨겨져야 한다.
//   — DOM 상 <details> 의 `open` 속성이 토글되는지 로 확인.

test('scoping skip accordion — 기본 접힘, summary 클릭 시 펼침/접힘 토글', async ({ page }) => {
  await loginViaUi(page);

  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('accordion');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}\/scoping/);

  await page.getByLabel('사업부지 면적', { exact: false }).first().fill('8000');
  await page.getByLabel('용도지역').selectOption('agricultural_forestry');
  await page.getByRole('button', { name: '검토 실행', exact: true }).click();

  // rule pack 버전이 뜰 때까지 대기 (결과 렌더 완료 시그널)
  await expect(page.getByTestId('rule-pack-version')).toBeVisible();

  const skipped = page.locator('section[aria-label="스킵된 규칙"]');
  const details = skipped.locator('details');

  // 기본: 접힘 (open 속성 없음)
  await expect(details).not.toHaveAttribute('open', '');
  const reasonLocator = skipped.getByText('해당 임계값에 도달하지 않았습니다.').first();
  await expect(reasonLocator).toBeHidden();

  // 펼치기
  await skipped.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(reasonLocator).toBeVisible();

  // 다시 접기
  await skipped.locator('summary').click();
  await expect(details).not.toHaveAttribute('open', '');
  await expect(reasonLocator).toBeHidden();
});
