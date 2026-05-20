/**
 * C02 — Claim race: two concurrent claims, exactly one wins.
 *
 * PIN: commit `9de7ee4` — `expense.service.ts` `claimExpense` uses an atomic
 * `Expense.findOneAndUpdate(..., { $or: [{ paidByUserId: { $exists: false } },
 * { paidByUserId: null }] }, { $set: { paidByUserId: requesterMember.userId } })`.
 * If the conditional update is replaced with a read-modify-write or with a
 * non-conditional update, BOTH concurrent claims will succeed (an "update lost"
 * regression where the second claim silently overwrites the first); this test
 * is the canonical regression pin for that fix.
 *
 * Setup:
 *   - Split-mode couple household
 *   - One unclaimed expense (seeded via API)
 *   - Admin and Partner each on /dashboard/expenses, both expanded on the row
 *
 * Race:
 *   - Both contexts press "Claim expense" "simultaneously" (via Promise.all on
 *     the click handlers). The backend serialises them at the Mongo layer.
 *
 * Assertions:
 *   - Exactly one of the two HTTP responses returned 2xx (winner).
 *   - Exactly one returned 4xx (loser; specifically 400 — "already claimed").
 *   - The loser's page shows an inline error region (role="alert" — set by
 *     ExpensesPage's `setActionError` after `extractApiError` runs on the
 *     mutation failure).
 *
 * The test deliberately does NOT care WHICH side wins — that's
 * implementation-defined by Mongo's write ordering.
 */
import { test, expect, type Page, type APIResponse } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedExpense } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

async function openClaimReady(page: Page, description: string): Promise<void> {
  await page.goto('/dashboard/expenses');
  await page.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });
  await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
  // Expand the row so the Claim button is in the DOM.
  await page.getByText(description).click();
  await expect(page.getByRole('button', { name: /^claim expense$/i })).toBeVisible({ timeout: 5_000 });
}

test('C02 — concurrent claims: exactly one 2xx, exactly one 4xx; loser sees inline alert', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    const seeded = await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 50,
      description: 'C02 claim race',
      category: 'groceries',
    });

    const adminPage = await couple.adminContext.newPage();
    const partnerPage = await couple.partnerContext.newPage();

    await Promise.all([
      openClaimReady(adminPage, 'C02 claim race'),
      openClaimReady(partnerPage, 'C02 claim race'),
    ]);

    // Predicate matches the per-household claim URL for THIS expense — both
    // contexts route claims to the same path, so the response promises
    // discriminate by Page, not by URL.
    const claimUrlMatch = (url: string): boolean =>
      url.includes(`/expenses/${seeded._id}/claim`);

    const adminResponse = adminPage.waitForResponse(
      (res) => claimUrlMatch(res.url()),
      { timeout: 10_000 }
    );
    const partnerResponse = partnerPage.waitForResponse(
      (res) => claimUrlMatch(res.url()),
      { timeout: 10_000 }
    );

    // Fire both clicks "as simultaneously as possible". Playwright clicks
    // are async; Promise.all schedules them on the same microtask tick and
    // the underlying HTTP requests leave the browsers within a few
    // milliseconds of each other. The atomic findOneAndUpdate in the
    // backend serialises them at the storage layer.
    await Promise.all([
      adminPage.getByRole('button', { name: /^claim expense$/i }).click(),
      partnerPage.getByRole('button', { name: /^claim expense$/i }).click(),
    ]);

    const settled = await Promise.allSettled([adminResponse, partnerResponse]);

    const responses: APIResponse[] = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled') {
        throw new Error(`Did not capture claim response: ${r.reason}`);
      }
      responses.push(r.value);
    }

    const statuses = responses.map((r) => r.status());
    const successes = statuses.filter((s) => s >= 200 && s < 300);
    const failures = statuses.filter((s) => s >= 400 && s < 500);

    expect(successes.length, `expected exactly one winner, got statuses ${JSON.stringify(statuses)}`).toBe(1);
    expect(failures.length, `expected exactly one loser, got statuses ${JSON.stringify(statuses)}`).toBe(1);

    // The loser is whichever Page returned the 4xx response. Map back to
    // the page that emitted it.
    const loserIndex = statuses.findIndex((s) => s >= 400 && s < 500);
    const loserPage = loserIndex === 0 ? adminPage : partnerPage;

    // The mutation's onError path in DashboardContext invalidates the
    // expenses query AND surfaces an extractApiError-derived message. The
    // ExpensesPage's `actionError` state renders a role="alert" div near
    // the top of the list. Wait for it to appear on the loser's screen.
    await expect(loserPage.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
