import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/login';

// Scoping happy-path v2 (plan T24):
//   login → 새 프로젝트(onshore_wind 기본) → /projects/[id]/scoping
//   입력: site_area=8000㎡, zone=agricultural_forestry, forest_conversion=800㎡, capacity 미입력
//   기대:
//     triggered 2건
//       - small_eia_other_zones (agri_forestry 7,500㎡ 임계)
//       - forest_conversion_review (660㎡ 임계)
//     skipped 3건 (details 열어서 확인)
//       - eia_target_capacity (input_undefined — capacity_mw 없음)
//       - small_eia_conservation (condition_not_met — equals(zone, conservation_management) false)
//       - small_eia_planning   (condition_not_met — equals(zone, planning_management) false)
//       NOTE: 엔진은 equals 연산자가 false 일 때 zone_mismatch 가 아니라 condition_not_met
//       을 반환한다 (engine.ts L77, engine.test.ts L65-71 참조). plan 문구는 간략 표기.
//     고정 배너(aside aria-label="스코핑 한계 고지")
//     rule_pack_version = onshore_wind/v2.2026-04-23

test('scoping happy v2 — 2 triggered + 3 skipped, rule pack version visible', async ({
  page
}) => {
  await loginViaUi(page);

  // 프로젝트 생성 (NewProjectModal 는 client:load 이므로 hydration retry 패턴)
  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('scoping happy v2');
  await page.selectOption('select[name="site_region_code"]', '42');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  // 스코핑 탭으로 이동
  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}\/scoping/);

  // 고정 배너 — 법적 단정 금지 고지가 항상 상단에 있어야 함
  await expect(page.getByRole('complementary', { name: '스코핑 한계 고지' })).toBeVisible();

  // 입력
  await page.getByLabel('사업부지 면적', { exact: false }).first().fill('8000');
  await page.getByLabel('용도지역').selectOption('agricultural_forestry');
  await page.getByLabel('산지전용 예정 면적 (선택)', { exact: false }).first().fill('800');

  // 실행
  await page.getByRole('button', { name: '검토 실행', exact: true }).click();

  // rule pack version DOM assertion
  const version = page.getByTestId('rule-pack-version');
  await expect(version).toHaveText('onshore_wind/v2.2026-04-23');

  // 발동 섹션 — 2카드
  const triggered = page.locator('section[aria-label="발동된 규칙"]');
  await expect(
    triggered.getByRole('heading', {
      name: '소규모 환경영향평가 — 농림/자연환경보전/생산관리 3존 번들'
    })
  ).toBeVisible();
  await expect(
    triggered.getByRole('heading', { name: '산지전용허가 — 660㎡ 이상 타당성조사 대상' })
  ).toBeVisible();
  await expect(triggered.getByText('발동 (2)')).toBeVisible();

  // 스킵 섹션 — 아코디언 펼침
  const skipped = page.locator('section[aria-label="스킵된 규칙"]');
  await skipped.getByRole('group').locator('summary').click();
  await expect(
    skipped.getByRole('heading', { name: '환경영향평가 대상 여부 — 발전시설용량 100 MW' })
  ).toBeVisible();
  await expect(
    skipped.getByRole('heading', { name: '소규모 환경영향평가 — 보전관리지역 5,000㎡' })
  ).toBeVisible();
  await expect(
    skipped.getByRole('heading', { name: '소규모 환경영향평가 — 계획관리지역 10,000㎡' })
  ).toBeVisible();

  // skip_reason 문구 확인 — capacity 없음 → input_undefined, 나머지 2건은 equals false 로
  // condition_not_met (zone_mismatch 는 one_of/gte_by_zone 용).
  await expect(skipped.getByText('입력 미기재', { exact: false }).first()).toBeVisible();
  await expect(skipped.getByText('해당 임계값에 도달하지 않았습니다.').first()).toBeVisible();
});
