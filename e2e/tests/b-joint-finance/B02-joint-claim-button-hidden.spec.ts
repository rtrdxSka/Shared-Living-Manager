/**
 * B02 — Claim button is never rendered for joint-mode expenses.
 *
 * PIN: commit `ab446cb` — ExpenseRow's `canClaim` derives from
 * `isSplitModeLocal && ...` only via the OUTSTANDING section, but the
 * row also computes `canClaim = isUnpaidLocal && myParticipatesInFinances`.
 * The wider regression guard is that joint expenses are auto-resolved
 * (`isResolved: true`) at the service layer, so the row's `canClaim` branch
 * only fires when the expense isUnpaid AND lives in Settled+joint, which the
 * UI never renders the Claim button for.
 *
 * Test approach: admin adds an expense, then both admin and partner expand the
 * row in their own context and assert that no "Claim expense" button is
 * visible.
 *
 * Joint-mode form requirement: `AddExpenseForm.tsx:181` makes the "Paid by"
 * field mandatory in joint mode (`paidByRequired = ... || financeMode ===
 * 'joint'`). Submit stays disabled until a payer is picked, so the test
 * selects the admin via the PAID BY combobox before submitting.
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

test('B02 — joint-mode expense row never offers a Claim button', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    // ── 1. Admin creates an expense via the UI ──
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/expenses');
    await adminPage.getByRole('button', { name: /add expense/i }).first().click();
    await adminPage.getByPlaceholder('e.g. Monthly rent').fill('B02 joint groceries');
    await adminPage.getByPlaceholder('0.00').fill('45');
    // Joint mode requires a payer (AddExpenseForm.tsx:181) — submit is
    // disabled until PAID BY is set. The label has no htmlFor, so scope to
    // the label's parent div to reach the Radix Select trigger.
    await adminPage
      .locator('label:has-text("PAID BY")')
      .locator('..')
      .getByRole('combobox')
      .click();
    await adminPage.getByRole('option', { name: 'Admin' }).click();
    await adminPage.getByRole('button', { name: /add expense/i }).last().click();

    // The row is collapsed by default. Wait for it to render in the SETTLED
    // section, then click to expand so action buttons (if any) are revealed.
    const adminRow = adminPage.getByText('B02 joint groceries');
    await expect(adminRow).toBeVisible({ timeout: 10_000 });
    await adminRow.click();

    // The "Claim expense" button is the only `canClaim` surface. In joint
    // mode, expenses are auto-resolved on create (no `paidByUserId` set or
    // not — irrelevant once `isResolved=true` because resolved-status flag
    // gates ExpenseRow's edit/delete/claim buttons elsewhere). Assert it's
    // absent.
    await expect(
      adminPage.getByRole('button', { name: /claim expense/i }),
    ).toHaveCount(0);

    // ── 2. Same assertion from the partner context ──
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/expenses');
    const partnerRow = partnerPage.getByText('B02 joint groceries');
    await expect(partnerRow).toBeVisible({ timeout: 10_000 });
    await partnerRow.click();
    await expect(
      partnerPage.getByRole('button', { name: /claim expense/i }),
    ).toHaveCount(0);
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
