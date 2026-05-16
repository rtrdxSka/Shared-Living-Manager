import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { registerAndVerify, loginAs } from '../../support/auth';

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
 * A04 — Invalid invite code.
 *
 * A verified user without a household lands on `/get-started`. They pick
 * "Join a household" and submit a syntactically-valid-but-nonexistent
 * UUID as the invite code. The frontend Zod schema
 * (`joinHouseholdSchema` in `FrontEnd/src/schemas/household.schemas.ts`)
 * enforces UUID shape client-side, so a free-form string like
 * `'no-such-code'` would fail validation BEFORE the request was issued
 * — that's a different error path than the one this spec wants to
 * exercise. We use a well-formed but unregistered UUID instead, so the
 * request reaches the backend and `householdService.joinHousehold`
 * (BackEnd/src/services/household.service.ts:134) throws
 * `NotFoundError('Invalid invite code')`. The frontend `JoinView`
 * surfaces that message verbatim in the `serverError` paragraph.
 *
 * Why the redirect assertion: a successful join calls
 * `navigate('/dashboard', { replace: true })`. We assert that the URL
 * is STILL on `/get-started` after the submit (i.e. the user wasn't
 * advanced past the join screen).
 */
test('A04 — Invalid invite code shows error and stays on /get-started', async ({
  browser,
}) => {
  const user = {
    email: `invalid-invite-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Invite',
    lastName: 'Tester',
  };

  // 1. Register + verify via the API helper. The user lands in the
  //    database verified but without a household.
  await registerAndVerify(user);

  // 2. Drive /login via the UI. loginAs accepts a redirect to
  //    /dashboard, /onboarding, or /get-started. For a verified user
  //    with no household, AuthContext/HomePage routes them to
  //    /get-started.
  const context = await browser.newContext();
  try {
    const page = await loginAs(context, user.email, user.password);

    // Ensure we're on /get-started (loginAs accepts multiple targets).
    if (!page.url().includes('/get-started')) {
      await page.goto('/get-started');
    }

    // 3. Click the "Join a household" tile (rendered as a <button> on
    //    the choice view in GetStartedPage.tsx).
    await page.getByRole('button', { name: /join a household/i }).click();

    // 4. The JoinView renders an <Input placeholder="xxxxxxxx-…">. Use
    //    the placeholder to anchor — there's only one text input on
    //    this view.
    const validButUnknownUuid = '00000000-0000-0000-0000-000000000000';
    await page
      .getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
      .fill(validButUnknownUuid);

    // 5. Submit. The button label is "Join →" (the arrow is part of
    //    the rendered text); match by accessible name regex.
    await page.getByRole('button', { name: /^join/i }).click();

    // 6. Assert the inline server-error paragraph appears with the
    //    backend's "Invalid invite code" message.
    await expect(
      page.getByText(/invalid invite code/i),
    ).toBeVisible({ timeout: 10_000 });

    // 7. URL must NOT have advanced to /dashboard.
    expect(page.url()).not.toContain('/dashboard');
    // Sanity: still on the get-started page (the Join sub-view).
    expect(page.url()).toContain('/get-started');
  } finally {
    await context.close();
  }
});
