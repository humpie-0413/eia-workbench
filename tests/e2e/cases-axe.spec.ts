import { test, type Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { loginViaUi } from './helpers/login';

const AXE_OPTIONS = {
  detailedReport: true,
  detailedReportOptions: { html: true },
  includedImpacts: ['moderate', 'serious', 'critical'] as Array<
    'minor' | 'moderate' | 'serious' | 'critical'
  >
};

async function waitSettled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}

test('cases search page passes axe smoke', async ({ page }) => {
  await loginViaUi(page);
  await page.goto('/cases');
  await waitSettled(page);
  await injectAxe(page);
  await checkA11y(page, undefined, AXE_OPTIONS);
});
