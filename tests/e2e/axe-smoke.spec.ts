import { test, type Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const PASSWORD = process.env['E2E_APP_PASSWORD'] ?? 'change-me-long-random';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test('login page passes axe smoke', async ({ page }) => {
  await page.goto('/login');
  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true });
});

test('project list passes axe smoke', async ({ page }) => {
  await login(page);
  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true });
});

test('project detail page passes axe smoke', async ({ page }) => {
  await login(page);

  // Create a project so we can scan /projects/[id]
  await page.getByRole('button', { name: '새 프로젝트' }).click();
  await page.fill('input[name="name"]', 'axe smoke test');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);

  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true });
});
