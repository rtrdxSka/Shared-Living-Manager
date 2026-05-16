/**
 * C04 — Split-mode delete expense authorization.
 *
 * PIN: —
 *
 * Two-part check, mirroring `expense.service.deleteExpense` (lines ~162-186):
 *   - the creator (admin) CAN delete their own unresolved expense; the row
 *     disappears for both contexts after the mutation.
 *   - the non-creator (partner) does NOT see the "Delete expense" button on
 *     the admin's expense — the row's `ExpenseRow` gates the button on
 *     `isCreatorLocal && !isResolved && !pendingConfirmation`
 *     (ExpensesPage.tsx ~line 617). If the gate slipped client-side, the
 *     server would still 403, but the test asserts the UI-level invariant.
 *
 * The delete flow is a two-step confirmation: the first click opens an inline
 * "Delete this expense?" prompt with "Yes, delete" / "Cancel"; "Yes, delete"
 * triggers the mutation. There is no separate dialog component for this — see
 * ExpensesPage.tsx lines ~803-816.
 */
import { test, expect } from '@playwright/test';

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

test('C04 — split-mode delete: admin can delete own expense; partner sees no Delete control on it', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    // ── 1. Admin seeds an unclaimed expense ────────────────────────────
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 18,
      description: 'C04 admin-owned expense',
      category: 'groceries',
    });

    // ── 2. Partner expands the row and DOES NOT see "Delete expense" ────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/expenses');
    await partnerPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });
    await expect(partnerPage.getByText('C04 admin-owned expense')).toBeVisible({ timeout: 10_000 });
    await partnerPage.getByText('C04 admin-owned expense').click();

    // The "Claim expense" button IS visible (split-mode + unpaid + partner
    // is a financial member — that's the canClaim path). We assert its
    // visibility to prove the row IS expanded, then assert Delete is not.
    await expect(
      partnerPage.getByRole('button', { name: /^claim expense$/i })
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      partnerPage.getByRole('button', { name: /^delete expense$/i })
    ).toHaveCount(0);

    // ── 3. Admin expands the same row and DOES see "Delete expense" ─────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/expenses');
    await adminPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });
    await expect(adminPage.getByText('C04 admin-owned expense')).toBeVisible({ timeout: 10_000 });
    await adminPage.getByText('C04 admin-owned expense').click();

    const deleteBtn = adminPage.getByRole('button', { name: /^delete expense$/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });

    // ── 4. Click Delete → inline "Yes, delete" confirmation ─────────────
    await deleteBtn.click();
    const confirmBtn = adminPage.getByRole('button', { name: /^yes, delete$/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // ── 5. Row disappears for admin and (after reload) for partner ──────
    await expect(adminPage.getByText('C04 admin-owned expense')).toHaveCount(0, { timeout: 10_000 });

    await partnerPage.reload();
    await partnerPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });
    await expect(partnerPage.getByText('C04 admin-owned expense')).toHaveCount(0, { timeout: 10_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
