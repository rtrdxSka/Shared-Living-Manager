import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { registerAndVerify } from '../../support/auth';

// ── Per-test database reset ─────────────────────────────────────────────
// Each spec starts from a known-empty database. The /api/__test__/reset
// endpoint is only mounted when the backend boots with NODE_ENV=test, so
// the call is a no-op (404) in any non-e2e environment.

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

/**
 * A06 — Duplicate email registration.
 *
 *   1. Pre-create a verified user via `registerAndVerify` (API only).
 *   2. Open the /register page in a fresh browser context (so no
 *      session lingers from the pre-create step — `registerAndVerify`
 *      uses a Playwright APIRequestContext, not the page-fixture
 *      browser, so no cookies are set on the page anyway, but we
 *      explicitly clear in case the GuestRoute would otherwise punt
 *      us off /register).
 *   3. Fill the /register form with the SAME email but a different
 *      first/last name.
 *   4. Submit — the backend's `authService.register` throws
 *      `ConflictError('A user with this email already exists')`
 *      (BackEnd/src/services/auth.service.ts:36). The frontend
 *      `RegisterPage` surfaces that message verbatim in the
 *      `serverError` `<p>`.
 *   5. Assert the inline error is visible (regex matches "already
 *      exists") and that we are still on /register (i.e. the
 *      register flow did NOT auto-log-in as it would on a successful
 *      submit).
 *
 * Why not `uiRegister`: that helper's post-submit assertion is "URL
 * changes away from /register" — but for a duplicate-email submit,
 * the URL stays on /register (which is exactly what we want to
 * assert). So we drive the form manually.
 */
test('A06 — Registering with an existing email shows an inline error', async ({
  page,
  context,
}) => {
  const sharedEmail = `dup-${Date.now()}@example.com`;

  // 1. Pre-create the user via the API helper.
  await registerAndVerify({
    email: sharedEmail,
    password: 'Password123!',
    firstName: 'Original',
    lastName: 'User',
  });

  // 2. Ensure the browser context is unauthenticated before hitting
  //    /register. `registerAndVerify` uses an isolated API context, so
  //    in practice no cookies/localStorage leak — but this guards
  //    against GuestRoute redirecting an authenticated user off
  //    /register if that assumption ever changes.
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  // 3. Drive the /register form manually with the SAME email but
  //    different name fields. Placeholder selectors match the strategy
  //    used by `uiRegister` (see e2e/support/auth.ts).
  await page.goto('/register');
  await page.getByPlaceholder('Ivan', { exact: true }).fill('Different');
  await page.getByPlaceholder('Smith', { exact: true }).fill('Person');
  await page.getByPlaceholder('ivan@example.com').fill(sharedEmail);
  const passwordFields = page.getByPlaceholder('••••••••');
  await passwordFields.nth(0).fill('Password123!');
  await passwordFields.nth(1).fill('Password123!');
  await page.getByRole('button', { name: /create account/i }).click();

  // 4. Inline error: the backend returns
  //    "A user with this email already exists". The frontend renders
  //    that string verbatim in a `<p>` with no role/aria-live.
  //
  //    The page footer also contains the literal text "Already have an
  //    account?" — so the loose regex `/already|exists|.../i` matches
  //    two elements and trips Playwright's strict-mode locator. We
  //    anchor on the two-word phrase "already exists" which appears
  //    only in the server-error string.
  await expect(
    page.getByText(/already exists|in use|registered|taken/i),
  ).toBeVisible({ timeout: 10_000 });

  // 5. URL must still be /register — the register flow did not
  //    advance (no auto-login on duplicate-email).
  expect(page.url()).toMatch(/\/register$/);
});
