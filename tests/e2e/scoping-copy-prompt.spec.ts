import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// T27-a scoping-copy-prompt:
//   "Claude 분석 프롬프트 복사" 버튼을 누르면 clipboard 에 Markdown 프롬프트가 복사되고,
//   프롬프트에는 CLAUDE.md §2 제약 + 사용자 입력 JSON + triggered/skipped 섹션이
//   포함되어야 한다.

test('copy prompt — 클립보드에 검토 보조 프롬프트가 복사된다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loginViaUi(page);

  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('copy prompt');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}\/scoping/);

  await page.getByLabel('사업부지 면적', { exact: false }).first().fill('8000');
  await page.getByLabel('용도지역').selectOption('agricultural_forestry');
  await page.getByRole('button', { name: '검토 실행', exact: true }).click();

  await expect(page.getByTestId('rule-pack-version')).toBeVisible();

  await page.getByRole('button', { name: 'Claude 분석 프롬프트 복사' }).click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('역할: 환경영향평가 검토 보조.');
  expect(clipboard).toContain('CLAUDE.md §2');
  expect(clipboard).toContain('rule pack: onshore_wind/v2.2026-04-23');
  expect(clipboard).toContain('## 사용자 입력');
  expect(clipboard).toContain('## 자동 엔진이 발동시킨 규칙');
  expect(clipboard).toContain('## 자동 엔진이 스킵한 규칙');
  // 금지 표현이 프롬프트 guardrail 으로 명시되어 있는지 확인
  expect(clipboard).toContain('금지:');
});
