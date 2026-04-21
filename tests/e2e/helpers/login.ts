import type { Page } from '@playwright/test';

export const E2E_PASSWORD = process.env['E2E_APP_PASSWORD'] ?? 'change-me-long-random';

// Turnstile injects a hidden input[name="cf-turnstile-response"] asynchronously
// once the always-pass test sitekey (1x00000000000000000000AA) resolves. If the
// form is submitted before that input exists and has a non-empty value,
// loginSchema's turnstileToken.min(1) rejects and the page re-renders with the
// "입력값을 다시 확인해 주세요" alert — the flake that broke PR #1's axe-smoke
// when three workers raced the Turnstile API in parallel.
export async function loginViaUi(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="password"]', E2E_PASSWORD);
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return el instanceof HTMLInputElement && el.value.length > 0;
    },
    null,
    { timeout: 15_000 }
  );
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}
