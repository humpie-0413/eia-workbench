// Manual-only Lighthouse stub for /cases.
//
// Per spec docs/design/feature-similar-cases.md §9 ("성공 지표"):
//   - Performance ≥ 90, Accessibility ≥ 90.
//
// Run manually before each release:
//   npx lhci collect --url=http://localhost:3000/cases --headful=false
//   npx lhci assert --preset=lighthouse:recommended --assertions.categories.performance=warn
//
// Not wired into Playwright runner — Lighthouse pulls headless Chromium with
// network throttling that conflicts with our existing Playwright fixtures
// (Turnstile login race). The §9 budget is enforced manually + on the deployed
// staging URL via /design-review per CLAUDE.md §9.4.
//
// This file deliberately contains no test() blocks so the Playwright runner
// will report it as having "no tests" rather than skipping silently.
//
// T6-3 (plan T31, Step 2).
export {};
