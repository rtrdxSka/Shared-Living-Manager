/**
 * F02 — Couple budget flow, JOINT mode: budget page renders Payment Activity
 * (not Spending Comparison), shows only the paid row per category (no share
 * row), no paid sub-line in the comparison card, and the over-budget banner
 * still appears on the Overview page when a budget is breached.
 *
 * Flow (joint-mode couple):
 *   1. Create the couple household via `createCoupleHousehold({financeMode:
 *      'joint'})` — confirms the helper accepts joint mode (see
 *      buildCoupleHouseholdPayload in e2e/support/household.ts).
 *   2. Set the `groceries` budget to 50 EUR via `PUT /api/households/:id/
 *      budget` (admin-only; same constraints as F01).
 *   3. Seed a single 100 EUR groceries expense paid by the admin. Joint mode
 *      doesn't need per-member attribution for the assertions in this test
 *      (no share line is rendered), so one expense is enough to push the
 *      household over the 50-EUR budget and to populate the paid row.
 *   4. Admin opens `/dashboard/budget`:
 *      - Assert the CoupleSpendComparisonCard title is "Payment Activity"
 *        (paid-mode label; "Spending Comparison" is the share-mode label).
 *      - Assert `comparison-paid-subline` is NOT present (the sub-line only
 *        renders when mode === 'share' — see CoupleSpendComparisonCard.tsx
 *        line ~130).
 *      - Assert `budget-paid-groceries` IS visible — BudgetPage threads
 *        `byMemberSplit` even in joint mode (without a `share` entry), and
 *        CategoryBudgetRow renders the paid line off the always-present
 *        `paid` field.
 *      - Assert `budget-split-groceries` is NOT visible — the share line
 *        only renders when `byMemberSplit.share` is defined, which BudgetPage
 *        omits in joint mode (`me.shareByCategory` undefined → `share =
 *        undefined`).
 *   5. Admin then navigates to `/dashboard/overview` and asserts the
 *      `over-budget-banner` still appears — the banner is finance-mode
 *      agnostic (it reads the same `byCategory` totals as BudgetPage).
 *
 * Why a single expense (vs F01's two):
 *   - F01 needs per-member non-zero totals to make the share row render.
 *     Joint mode has no share row at all, so one expense in the right
 *     category is enough to over-shoot the budget and exercise the paid row.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedExpense } from '../../support/dataFactory';

const API_BASE = 'http://localhost:5001';

/**
 * Local copy of F01's `whoami` helper — joint-mode expenses still need a
 * `paidByUserId` to surface in `paidByCategory`. Without it the expense is
 * recorded with no payer, every member's attribution has `paid: 0`, and the
 * per-category map ends up empty (BudgetPage skips zero-activity entries).
 */
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
 * Local copy of F01's `setBudget` helper. Kept inline (not extracted) so each
 * spec stays self-describing; if a third budget spec lands, promote this to
 * `e2e/support/budget.ts`.
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

test('F02 — joint-mode budget page shows Payment Activity (no sub-line) + paid-only category row, banner still appears', async ({
  browser,
}) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    // ── 0. Resolve admin userId so we can attribute the seeded expense ──
    // Required even in joint mode: BudgetPage's per-category map only emits
    // a row when `paidByCategory[cat]` is non-zero for at least one member,
    // and `paidByCategory` is keyed off the expense's `paidByUserId`.
    const adminUserId = await whoami(couple.adminToken);

    // ── 1. Set the groceries budget low (50 EUR) ──────────────────────
    await setBudget(couple.adminToken, couple.household._id, { groceries: 50 });

    // ── 2. Seed a single 100-EUR groceries expense paid by the admin ──
    // Total 100 EUR vs 50 budget → over budget. We DO need `paidByUserId`
    // so the admin's `paidByCategory.groceries` is non-zero — without it
    // every attribution comes back with `paid: 0` and the row is skipped.
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 100,
      description: 'F02 joint groceries',
      category: 'groceries',
      paidByUserId: adminUserId,
    });

    // ── 3. Admin opens /dashboard/budget directly ─────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/budget');
    await adminPage.waitForURL(/\/dashboard\/budget/, { timeout: 10_000 });

    // ── 4a. Comparison card renders in PAID mode ──────────────────────
    // Joint mode → BudgetPage passes mode="paid" →
    // CoupleSpendComparisonCard renders "Payment Activity" (NOT "Spending
    // Comparison"). Wait for it explicitly because the page also does an
    // async budget fetch before the card renders.
    await expect(adminPage.getByText('Payment Activity')).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Spending Comparison')).toHaveCount(0);

    // ── 4b. Paid sub-line is NOT present in joint mode ────────────────
    // `comparison-paid-subline` only renders when mode === 'share'.
    await expect(adminPage.getByTestId('comparison-paid-subline')).toHaveCount(0);

    // ── 4c. Paid row IS visible for groceries ─────────────────────────
    const groceriesPaid = adminPage.getByTestId('budget-paid-groceries');
    await expect(groceriesPaid).toBeVisible({ timeout: 10_000 });

    // ── 4d. Share row is NOT visible in joint mode ────────────────────
    await expect(adminPage.getByTestId('budget-split-groceries')).toHaveCount(0);

    // ── 5. Over-budget banner appears on the Overview page ────────────
    await adminPage.goto('/dashboard/overview');
    await adminPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });
    await expect(adminPage.getByTestId('over-budget-banner')).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
