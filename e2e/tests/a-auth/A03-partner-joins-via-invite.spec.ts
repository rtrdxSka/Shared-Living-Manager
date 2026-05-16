import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';

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
 * A03 — Partner joins admin's household via invite code (parallel
 * BrowserContexts).
 *
 * This is the first spec that exercises two parallel `BrowserContext`
 * instances — the model for every couple-mode flow in groups B/C/D/E. Both
 * sides of the household authenticate independently (separate cookie jars,
 * separate localStorage) so future tests can drive concurrent actions
 * without leaking session state.
 *
 * Setup is delegated wholesale to `createCoupleHousehold`, which:
 *   1. Registers + verifies admin and partner via the test API.
 *   2. Logs admin in and POSTs the full onboarding-survey payload to
 *      `/api/households` (creator nickname = admin.firstName, partner
 *      nickname = partner.firstName, partner email pre-registered in
 *      `memberStructure[0].email`).
 *   3. Logs partner in and POSTs `{ inviteCode }` to `/api/households/join`.
 *      The backend's `joinHousehold` (see `household.service.ts` line 165)
 *      finds the placeholder member matching the partner's email and links
 *      `userId` to that slot — so the household ends up with two members
 *      whose nicknames are exactly `Admin` and `Partner`.
 *   4. Spins up two BrowserContexts and drives the /login form in each.
 *
 * Where the names render on `/dashboard`:
 *   - The dashboard root redirects to `/dashboard/overview` (App.tsx).
 *   - The AppLayout sidebar renders `{myNickname} & {partnerNickname}` in a
 *     `<span>` under the household card (AppLayout.tsx line 155).
 *   - The OverviewPage header subtitle also renders
 *     `${myNickname} & ${partnerNickname} · ${household.name}` (OverviewPage.tsx
 *     line 88).
 * Either surface is acceptable; the sidebar is the most stable anchor since
 * it's the same across every dashboard subpage.
 */
test('A03 — Partner joins admin household via invite code (parallel contexts)', async ({
  browser,
}) => {
  // ── 1. Build the couple household end-to-end via the helper ────────────
  // The helper owns registration, household creation, and the partner join.
  // If any step fails it surfaces as a thrown Error here — the spec stays
  // focused on the dashboard-visibility assertions.
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'rotation',
  });

  try {
    // ── 2. Admin side: partner's name is visible on /dashboard ───────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard');
    // /dashboard redirects to /dashboard/overview via the index route.
    await adminPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });
    // The sidebar `<span>` and OverviewPage subtitle both render
    // "Admin & Partner". Use `.first()` because the same string is rendered
    // in multiple surfaces (sidebar + page header). The match is case-
    // sensitive on the nickname casing the helper chose (`Partner`).
    await expect(
      adminPage.getByText(couple.partner.firstName, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ── 3. Partner side: admin's name is visible on /dashboard ───────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard');
    await partnerPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });
    await expect(
      partnerPage.getByText(couple.admin.firstName, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    // Clean up both contexts so subsequent specs start from a clean slate.
    // (Playwright auto-closes browser fixtures, but each
    // `browser.newContext()` we created in the helper is ours to close.)
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
