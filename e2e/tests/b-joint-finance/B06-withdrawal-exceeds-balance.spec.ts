/**
 * B06 — Attempting to withdraw more than the current balance is rejected and
 * the balance is unchanged.
 *
 * Flow:
 *   1. Admin deposits 50 → balance 50.
 *   2. Admin opens the Withdraw form, fills 100. The form's client-side
 *      overdraw-confirm dialog ("Overdraw account?") appears first.
 *   3. Click "Continue" to proceed. The backend rejects with 400
 *      `Insufficient balance. Current balance: 50.00`. The form surfaces the
 *      message via `extractApiError`.
 *   4. Close the sheet — balance card still reads 50 (no withdrawal recorded).
 *
 * NOTE on the design surprise: the form does NOT block submission outright;
 * it shows an overdraw confirm. The "inline error" comes from the backend
 * once the user confirms. This is the spec's exercise of the
 * `BadRequestError('Insufficient balance...')` branch in
 * `joint-account.service.ts`.
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

test('B06 — withdrawal exceeding balance is rejected, balance unchanged', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    const page = await couple.adminContext.newPage();
    await page.goto('/dashboard/account');
    await page.waitForURL(/\/dashboard\/account/, { timeout: 10_000 });

    // ── 1. Deposit 50 ──
    await page.getByRole('button', { name: /^deposit$/i }).first().click();
    await page.getByPlaceholder('e.g. 500').fill('50');
    await page.getByRole('button', { name: /add deposit/i }).click();
    await expect(page.getByText('50.00 EUR').first()).toBeVisible({ timeout: 10_000 });

    // ── 2. Try to withdraw 100 ──
    await page.getByRole('button', { name: /^withdraw$/i }).click();
    await page.getByPlaceholder('e.g. 500').fill('100');
    await page.getByRole('button', { name: /add withdrawal/i }).click();

    // ── 3. Overdraw confirm dialog appears; click Continue ──
    const overdrawDialog = page.getByRole('alertdialog');
    await expect(overdrawDialog).toBeVisible({ timeout: 5_000 });
    await expect(overdrawDialog.getByText(/overdraw account/i)).toBeVisible();
    await overdrawDialog.getByRole('button', { name: /continue/i }).click();

    // ── 4. Backend rejects → form shows the "Insufficient balance" message ──
    await expect(page.getByText(/insufficient balance/i)).toBeVisible({ timeout: 10_000 });

    // ── 5. Balance is still 50 ──
    // The form is still open (sheet doesn't close on error). Close it by
    // pressing Escape, then verify the hero balance card has not changed.
    await page.keyboard.press('Escape');
    await expect(page.getByText('50.00 EUR').first()).toBeVisible({ timeout: 10_000 });
    // Sanity: 100 (the rejected attempt) does NOT appear as a balance.
    // We can't blanket-assert "no 100 anywhere" (the input may still hold it
    // until the sheet animates closed), so just check the visible CURRENT
    // BALANCE numeric is 50.
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
