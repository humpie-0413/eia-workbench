import { test, expect, type Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { loginViaUi } from './helpers/login';

// Turnstile iframe is third-party (challenges.cloudflare.com); we cannot fix
// a11y issues inside it, so exclude the widget's iframe and any element axe
// would traverse into it. The widget sits in .cf-turnstile on /login.
const AXE_CONTEXT = {
  exclude: [
    ['.cf-turnstile'],
    ['iframe[src*="challenges.cloudflare.com"]'],
    ['iframe[title*="Cloudflare"]']
  ]
};

// includedImpacts: the CI violations we hit (landmark-one-main, region) are
// rated "moderate" by axe, so restricting to serious+critical would silently
// let the same regression back in. Include moderate-and-up; skip only
// axe's "minor" bucket (mostly nice-to-have best-practices).
const AXE_OPTIONS = {
  detailedReport: true,
  detailedReportOptions: { html: true },
  includedImpacts: ['moderate', 'serious', 'critical'] as Array<
    'minor' | 'moderate' | 'serious' | 'critical'
  >
};

async function waitSettled(page: Page): Promise<void> {
  // Turnstile polls challenges.cloudflare.com so networkidle may never resolve
  // on /login — bound the wait and ignore timeout.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}

test('login page passes axe smoke', async ({ page }) => {
  await page.goto('/login');
  await waitSettled(page);
  await injectAxe(page);
  await checkA11y(page, AXE_CONTEXT, AXE_OPTIONS);
});

test('project list passes axe smoke', async ({ page }) => {
  await loginViaUi(page);
  await waitSettled(page);
  await injectAxe(page);
  await checkA11y(page, AXE_CONTEXT, AXE_OPTIONS);
});

test('project detail page passes axe smoke', async ({ page }) => {
  await loginViaUi(page);
  await waitSettled(page);

  // Create a project so we can scan /projects/[id].
  // NewProjectModal is a React island (client:load); the first click on "새
  // 프로젝트" can land before hydration finishes, leaving the <dialog> closed.
  // Retry the click until the dialog's name input becomes visible, then fill.
  const openButton = page.getByRole('button', { name: '새 프로젝트' });
  const nameInput = page.locator('dialog[open] input[name="name"]');
  await expect(async () => {
    await openButton.click();
    await expect(nameInput).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await nameInput.fill('axe smoke test');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]{12}/);
  await waitSettled(page);

  await injectAxe(page);
  await checkA11y(page, AXE_CONTEXT, AXE_OPTIONS);
});
