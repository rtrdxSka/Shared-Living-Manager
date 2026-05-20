/**
 * F01 — Couple budget flow: over-budget banner → budget page → per-member
 * split labels + Spending Comparison card.
 *
 * Flow (split-mode couple):
 *   1. Create the couple household via `createCoupleHousehold({financeMode:
 *      'split'})`.
 *   2. Resolve admin + partner userIds via `/api/auth/me` (so we can attribute
 *      seeded expenses to specific payers — the per-member breakdown is
 *      aggregated by `paidByUserId`).
 *   3. Set the `groceries` budget to 50 EUR via `PUT /api/households/:id/
 *      budget` (admin-only — backend rejects non-admin writers).
 *   4. Seed two groceries expenses — 150 EUR paid by admin and 80 EUR paid by
 *      the partner — so the total of 230 EUR is well over the 50-EUR budget
 *      AND both members have non-zero per-category spend (otherwise
 *      `byCategoryMap` in BudgetPage.tsx would omit the row's split label).
 *   5. Admin opens `/dashboard/overview`:
 *      - Assert the OverBudgetBanner is visible
 *        (`data-testid="over-budget-banner"`).
 *      - Click the "View budget breakdown →" link inside the banner.
 *      - Assert the URL becomes `/dashboard/budget`.
 *   6. On the budget page:
 *      - Assert the per-member SHARE row for groceries is visible
 *        (`data-testid="budget-split-groceries"`).
 *      - Assert the per-member PAID row for groceries is visible
 *        (`data-testid="budget-paid-groceries"`) and contains the "paid:"
 *        prefix that CategoryBudgetRow renders below the share line in split
 *        mode.
 *      - Assert the CoupleSpendComparisonCard renders ("Spending Comparison"
 *        + `data-testid="comparison-row-me"`).
 *      - Assert the paid sub-line inside the comparison card is visible
 *        (`data-testid="comparison-paid-subline"`) — the card is in
 *        share-mode for this split scenario, which is where the sub-line
 *        appears.
 *
 * Why split mode (not joint):
 *   - `byMember` in budget insights is aggregated by `paidByUserId`. In joint
 *     mode the expense form often omits `paidByUserId` (auto-resolved
 *     joint-account flow), which makes the per-member breakdown sparse and
 *     would defeat the per-member split label assertion. Split mode is the
 *     natural couple budget surface for this view.
 *
 * Why an API budget write (not the UI):
 *   - The plan says "use whichever flow has the cleanest existing helper".
 *     The budget UI is the very thing we navigate to in step 5; pre-seeding
 *     the budget via PUT keeps step 5 a clean read-only assertion (we'd
 *     otherwise have to click into edit mode just to arrange state).
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedExpense } from '../../support/dataFactory';

const API_BASE = 'http://localhost:5001';

async function whoami(token: string): Promise<string> {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const res = await ctx.get('/api/auth/me');
    if (!res.ok()) throw new Error(`whoami failed: ${res.status()} ${await res.text()}`);
    const body = (await res.json()) as {
      data?: { user?: { _id?: string; id?: string } };
    };
    const u = body.data?.user;
    const id = u?._id ?? u?.id;
    if (!id) throw new Error(`whoami missing user id: ${JSON.stringify(body)}`);
    return id;
  } finally {
    await ctx.dispose();
  }
}

/**
 * PUT /api/households/:id/budget — body `{ categories: { <key>: number } }`.
 * Confirmed in `BackEnd/src/validators/budget.validator.ts` and
 * `budget.routes.ts`. Admin-only.
 */
async function setBudget(
  token: string,
  householdId: string,
  categories: Record<string, number>,
): Promise<void> {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const res = await ctx.put(`/api/households/${householdId}/budget`, {
      data: { categories },
    });
    if (!res.ok()) {
      throw new Error(`setBudget failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('F01 — couple over-budget banner navigates to budget page with per-member split + comparison card', async ({
  browser,
}) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    // ── 1. Resolve userIds (needed for `paidByUserId` attribution) ────
    const adminUserId = await whoami(couple.adminToken);
    const partnerUserId = await whoami(couple.partnerToken);

    // ── 2. Set the groceries budget low (50 EUR) ──────────────────────
    await setBudget(couple.adminToken, couple.household._id, { groceries: 50 });

    // ── 3. Seed two groceries expenses, one per member ────────────────
    // Total 230 EUR vs 50 budget → well over budget.
    // Per-member: admin 150, partner 80 — both non-zero so the
    // `byCategoryMap` in BudgetPage.tsx records a `byMemberSplit` entry
    // for groceries and the row's split label renders.
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 150,
      description: 'F01 admin groceries',
      category: 'groceries',
      paidByUserId: adminUserId,
    });
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 80,
      description: 'F01 partner groceries',
      category: 'groceries',
      paidByUserId: partnerUserId,
    });

    // ── 4. Admin opens /dashboard/overview, sees the banner ───────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/overview');
    await adminPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });

    const banner = adminPage.getByTestId('over-budget-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // ── 5. Click the "View budget breakdown →" link inside the banner ─
    // The banner itself is a `<div>`, not a button — the click target is
    // the `<Link to="/dashboard/budget">` rendered at its bottom.
    await banner.getByRole('link', { name: /view budget breakdown/i }).click();
    await adminPage.waitForURL(/\/dashboard\/budget/, { timeout: 10_000 });
    expect(adminPage.url()).toMatch(/\/dashboard\/budget/);

    // ── 6a. Per-member share row for groceries ────────────────────────
    const groceriesSplit = adminPage.getByTestId('budget-split-groceries');
    await expect(groceriesSplit).toBeVisible({ timeout: 10_000 });

    // ── 6b. Per-member paid row for groceries (new) ───────────────────
    // CategoryBudgetRow now renders a second line below the share line in
    // split mode, prefixed with "paid: ". Assert visibility AND the prefix
    // text — the prefix is what disambiguates this row from the share line
    // visually.
    const groceriesPaid = adminPage.getByTestId('budget-paid-groceries');
    await expect(groceriesPaid).toBeVisible({ timeout: 10_000 });
    await expect(groceriesPaid).toHaveText(/paid:/i);

    // ── 6c. CoupleSpendComparisonCard ─────────────────────────────────
    await expect(adminPage.getByText('Spending Comparison')).toBeVisible();
    await expect(adminPage.getByTestId('comparison-row-me')).toBeVisible();

    // ── 6d. Paid sub-line inside the comparison card (new) ────────────
    // The card is in share-mode for this split scenario, which is the only
    // mode that renders the "paid: ..." sub-line below each member.
    await expect(adminPage.getByTestId('comparison-paid-subline')).toBeVisible();
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
