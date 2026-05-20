/**
 * B04 — Clicking the Withdraw button opens the form with the Withdrawal tab
 * active (regression pin for the "withdraw default tab" fix).
 *
 * PIN: DashboardContext exposes `openTransactionForm(type)` which sets
 * `transactionFormDefaultType` and pipes it into `<AddTransactionForm
 * defaultType=…>`. AccountPage's Withdraw button calls
 * `openTransactionForm('withdrawal')`. If anyone severs that wiring (or the
 * form goes back to hardcoding `useState('deposit')`), the Withdraw button
 * would silently open the form in Deposit mode — easy to miss without an e2e
 * gate.
 *
 * The form uses plain `<button type="button">` toggles, NOT Radix Tabs, so
 * `data-state="active"|"inactive"` was added explicitly in this spec's
 * supporting change (see e2e/support/selectors.ts → transactionFormTabWithdrawal).
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { TID } from '../../support/selectors';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('B04 — Withdraw button opens AddTransactionForm with Withdrawal tab active', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    const page = await couple.adminContext.newPage();
    await page.goto('/dashboard/account');
    await page.waitForURL(/\/dashboard\/account/, { timeout: 10_000 });

    // Hero balance card has the "Deposit" and "Withdraw" action buttons.
    // (Note: the Withdraw button is labelled "Withdraw" — not "Withdrawal" —
    // see AccountPage.tsx line 294.)
    await page.getByRole('button', { name: /^withdraw$/i }).click();

    // Sheet header "Add Transaction" is now visible.
    await expect(page.getByText(/add transaction/i).first()).toBeVisible({ timeout: 5_000 });

    // The Withdrawal tab MUST be marked active. Two complementary assertions:
    //   1. data-state="active" on the withdrawal tab button.
    //   2. The submit button reads "Add Withdrawal" (not "Add Deposit").
    const withdrawTab = page.getByTestId(TID.transactionFormTabWithdrawal);
    await expect(withdrawTab).toHaveAttribute('data-state', 'active');

    const depositTab = page.getByTestId(TID.transactionFormTabDeposit);
    await expect(depositTab).toHaveAttribute('data-state', 'inactive');

    await expect(page.getByRole('button', { name: /add withdrawal/i })).toBeVisible();
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
