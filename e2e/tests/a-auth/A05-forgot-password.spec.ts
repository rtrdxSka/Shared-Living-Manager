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
 * A05 — Forgot password.
 *
 * Walks the full forgot → reset → login-with-new-password flow:
 *
 *   1. Register + verify a user via `registerAndVerify`.
 *   2. UI: /forgot-password → fill email → submit → success state shows
 *      "Check your inbox" / "we sent a password reset link" copy.
 *   3. Fetch the raw reset token through `TestApi.getLastToken(email,
 *      'reset')`. The backend already stashes it via `recordRawToken`
 *      in `BackEnd/src/utils/email.ts`'s NODE_ENV=test branch (mirrors
 *      the verify path the A01 implementer added).
 *   4. UI: /reset-password?token=… → fill new password twice → submit.
 *      `ResetPasswordPage` shows a success state ("Password reset")
 *      with a "Sign in with new password" link — it does NOT auto-
 *      redirect. We click the link to land on /login.
 *   5. UI: log in with the NEW password. The user has no household, so
 *      LoginPage navigates to '/', then we wait for any post-login
 *      destination (HomePage / /get-started / /dashboard).
 *
 * Plan vs reality:
 *   - The plan says "Assert redirect to /login". The actual page
 *     surfaces a success card + button rather than auto-navigating, so
 *     we assert the success copy is visible and then click through.
 *   - Reset URL pattern is `?token=…` (confirmed in
 *     ResetPasswordPage.tsx and App.tsx).
 *   - The page deliberately strips the token from the URL on mount
 *     (`window.history.replaceState`), so reading the URL after load
 *     is NOT a reliable assertion target — assert on rendered copy
 *     instead.
 */
test('A05 — Forgot password → reset → login with new password', async ({
  page,
  context,
}) => {
  const user = {
    email: `forgot-${Date.now()}@example.com`,
    password: 'OldPassword123!',
    firstName: 'Forgot',
    lastName: 'User',
  };
  const newPassword = 'NewPassword456!';

  // 1. Register + verify via the API helper.
  await registerAndVerify(user);

  // 2. Drive /forgot-password through the UI.
  await page.goto('/forgot-password');
  await page.getByPlaceholder('ivan@example.com').fill(user.email);
  await page.getByRole('button', { name: /send reset link/i }).click();

  // Success state copy from ForgotPasswordPage.tsx.
  await expect(
    page.getByText(/check your/i).first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText(/we sent a password reset link/i),
  ).toBeVisible();

  // 3. Pull the raw reset token via the test-only endpoint.
  const testApi = await TestApi.create();
  const resetToken = await testApi.getLastToken(user.email, 'reset');
  await testApi.dispose();

  // 4. Navigate to /reset-password?token=… and submit a new password.
  await page.goto(`/reset-password?token=${resetToken}`);
  // The page mounts and immediately strips `?token=…` from the URL
  // (history.replaceState) — but the form is still keyed off the
  // initial searchParams snapshot, so the submit handler sees it.
  const passwordFields = page.getByPlaceholder('••••••••');
  await passwordFields.nth(0).fill(newPassword);
  await passwordFields.nth(1).fill(newPassword);
  await page.getByRole('button', { name: /reset password/i }).click();

  // ResetPasswordPage renders a success card ("Password reset" heading
  // + "Sign in with new password" link). Click through to /login.
  await expect(
    page.getByText(/your password has been reset successfully/i),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: /sign in with new password/i }).click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });

  // 5. Log in with the NEW password and confirm a successful navigation
  //    off /login. The user has no household, so they go to '/'.
  // Reset-password revokes all refresh tokens (auth.service.ts:236-239),
  // but the access token may still linger in localStorage. Clear both
  // for a clean login.
  await context.clearCookies();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/login');
  await page.getByPlaceholder('ivan@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').first().fill(newPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding|get-started|$)/, {
    timeout: 10_000,
  });
  // Final sanity: we are no longer on /login.
  expect(page.url()).not.toMatch(/\/login$/);
});
