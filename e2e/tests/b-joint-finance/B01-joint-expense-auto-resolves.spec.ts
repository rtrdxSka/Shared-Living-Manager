/**
 * B01 — Joint-mode expense auto-resolves on creation.
 *
 * PIN: commit `ab446cb` — backend `expense.service.ts` (~lines 44-61) sets
 * `isResolved: true` + `resolvedAt: now` whenever a household is in
 * `financeMode === 'joint'`, and the ExpensesPage refuses to render the
 * OUTSTANDING section when finance mode is joint. If either side regresses,
 * this test fails.
 *
 * Flow: admin (UI) adds an expense in a joint-mode couple household. The
 * expense must:
 *   - NOT appear under an "Outstanding" section (the whole section is gated
 *     by `financeMode === 'split'`).
 *   - Appear under the "Settled" section in both admin and partner contexts
 *     (the partner reads the same household, so the auto-resolved flag is
 *     symmetrical).
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('B01 — joint-mode expense auto-resolves; appears only in Settled', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    // ── 1. Admin adds an expense via the UI ──────────────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/expenses');
    await adminPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    // The "+ Add expense" button opens the AddExpenseForm sheet.
    await adminPage.getByRole('button', { name: /add expense/i }).first().click();

    // Form is a side Sheet (radix Dialog). Fill description + amount and
    // submit. The Category Select defaults to the first EXPENSE_TYPE
    // ("rent"), which is in the household's `trackedExpenseTypes`.
    await adminPage.getByPlaceholder('e.g. Monthly rent').fill('B01 joint rent');
    await adminPage.getByPlaceholder('0.00').fill('120');
    // Submit button text is "Add Expense" in create-non-recurring mode.
    await adminPage.getByRole('button', { name: /add expense/i }).last().click();

    // ── 2. The OUTSTANDING section is NOT rendered (joint-mode gate) ─────
    // ExpensesPage line 305: `{financeMode === 'split' && ( <section> ... OUTSTANDING ... )}`
    // The EyebrowLabel with text "OUTSTANDING" must therefore be absent.
    await expect(adminPage.getByText('OUTSTANDING', { exact: true })).toHaveCount(0);

    // ── 3. The SETTLED section is rendered, with our expense in it ───────
    await expect(adminPage.getByText('SETTLED', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('B01 joint rent')).toBeVisible();

    // ── 4. Partner sees the same: no OUTSTANDING, expense in SETTLED ─────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/expenses');
    await partnerPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    await expect(partnerPage.getByText('OUTSTANDING', { exact: true })).toHaveCount(0);
    await expect(partnerPage.getByText('SETTLED', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(partnerPage.getByText('B01 joint rent')).toBeVisible();
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
