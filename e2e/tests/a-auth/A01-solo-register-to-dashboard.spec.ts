import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { uiRegister, uiVerifyEmail } from '../../support/auth';

// ── Per-test database reset ─────────────────────────────────────────────
// Every spec starts from a known-empty database. The /api/__test__/reset
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
 * A01 — Solo register-to-dashboard.
 *
 * Drives the full happy-path for a single-person household:
 *   register UI → verify-email UI → (log out + log in UI) → onboarding (solo)
 *   → /dashboard placeholder for non-couple uiMode.
 *
 * Real-codebase deviations from the plan's snippet, surfaced while writing
 * this test (so future readers don't repeat the investigation):
 *
 *  • RegisterPage auto-logs the user in on success (`AuthContext.register`
 *    calls `tokenStorage.set` + `setUser`) and then navigates to '/'. There
 *    is no intermediate "check your email" screen. To exercise the explicit
 *    /login step that the plan calls for, we drop the cookies/tokens after
 *    verification so the user is a guest again at /login.
 *
 *  • VerifyEmailPage reads the token from `?token=…` and POSTs to
 *    `/api/auth/verify-email`. On success it shows a heading containing the
 *    word "verified" — that's what `uiVerifyEmail` asserts on.
 *
 *  • There is no dedicated `SoloDashboard` component. DashboardPage hits the
 *    "Dashboard for this household type is coming soon." placeholder for any
 *    `household.uiMode !== 'couple'`, which is what solo (uiMode='solo')
 *    produces. That placeholder is therefore the success signal for this
 *    spec; the plan's "level-1 heading" assertion would never match because
 *    the placeholder is a `<p>`, not an `<h1>`.
 *
 *  • Step 1's living-arrangement option for solo is labelled
 *    "I live alone" (see LIVING_ARRANGEMENT_OPTIONS).
 */
test('A01 — Solo user completes full register → verify → onboarding → dashboard', async ({
  page,
  context,
}) => {
  const user = {
    email: `solo-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Solo',
    lastName: 'User',
  };

  // ── 1. Register via the UI ──────────────────────────────────────────
  // uiRegister submits the /register form and waits for any redirect off
  // /register (in practice the auto-login path lands the user on '/').
  await uiRegister(page, user);

  // ── 2. Verify the email via the UI ──────────────────────────────────
  // uiVerifyEmail fetches the latest verify token from /api/__test__ and
  // visits /verify-email?token=…; it asserts the "verified" success state.
  await uiVerifyEmail(page, user.email);

  // ── 3. Drop the auto-login session, then exercise /login ────────────
  // Register auto-logged the user in, but the plan requires us to walk the
  // /login form too. Clear cookies (refresh token) and localStorage
  // (access token) so the GuestRoute at /login actually renders the form
  // instead of redirecting an already-authenticated user away.
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto('/login');
  await page.getByPlaceholder('ivan@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').first().fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // LoginPage navigates to `/` on success; HomePage exposes a "Go to app"
  // link that points at /get-started for users without a household. We
  // navigate there directly so the test doesn't depend on hero copy.
  await page.waitForURL(/\/(get-started|dashboard|$)/, { timeout: 10_000 });
  if (!page.url().includes('/get-started')) {
    await page.goto('/get-started');
  }

  // ── 4. Pick "Create a household" from the choice screen ─────────────
  await page
    .getByRole('button', { name: /create a household/i })
    .click();

  // ── 5. Step 1: Living arrangement ───────────────────────────────────
  // FormField wires htmlFor={name}, so the household-name input is
  // accessible via its label text.
  await page.getByLabel('Household name').fill('Solo Pad');
  // The radio card for solo is rendered as a <button role="radio"> with the
  // visible label "I live alone".
  await page.getByRole('radio', { name: 'I live alone' }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 6. Step 2: Creator profile (no other-member fields for solo) ────
  await page.getByLabel('Nickname').fill('Solo');
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 7. Step 3: Tracked expense types (≥ 1 required) ─────────────────
  // The expense-type controls are styled <label> wrappers around a hidden
  // checkbox + visible text. The accessible label is the checkbox's name,
  // which Playwright surfaces as a 'checkbox' role with the expense-type
  // option label.
  await page.getByRole('checkbox', { name: 'Rent' }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 8. Step 4: Task management level (no distribution for solo) ─────
  // For solo, `shouldShowDistributionMethod` returns false, so the
  // distribution-method block is hidden regardless of the chosen level.
  // "Basic tasks" is the simplest valid selection.
  await page.getByRole('radio', { name: 'Basic tasks' }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 9. Step 5: Review + submit ──────────────────────────────────────
  await page
    .getByRole('button', { name: /create household/i })
    .click();

  // ── 10. Land on the dashboard ───────────────────────────────────────
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  // Solo households have uiMode='solo'; DashboardPage renders the
  // "coming soon" placeholder for any uiMode !== 'couple'. That copy is the
  // distinguishing element for this spec. Once a dedicated SoloDashboard
  // component lands, replace this assertion with that component's root
  // heading.
  await expect(
    page.getByText(/Dashboard for this household type is coming soon/i),
  ).toBeVisible({ timeout: 10_000 });
});
