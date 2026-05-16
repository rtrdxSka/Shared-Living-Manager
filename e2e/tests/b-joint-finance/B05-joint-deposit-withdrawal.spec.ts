/**
 * B05 — Joint-account deposit + withdrawal arithmetic.
 *
 * Flow:
 *   1. Admin deposits 100 → balance shows 100 (currency is EUR — see
 *      `buildCoupleHouseholdPayload` in `e2e/support/household.ts`).
 *   2. Admin withdraws 40 → balance shows 60.
 *   3. Partner navigates to /dashboard/account in their own context → also
 *      shows 60 (after a reload to bypass the 2-min React Query staleTime in
 *      `useJointAccountSummary`).
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

test('B05 — admin deposits then withdraws; partner sees the same balance', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/account');
    await adminPage.waitForURL(/\/dashboard\/account/, { timeout: 10_000 });

    // ── 1. Deposit 100 ─────────────────────────────────────────────────
    await adminPage.getByRole('button', { name: /^deposit$/i }).first().click();
    // The sheet's amount input is the only `type="number"` field.
    await adminPage.getByPlaceholder('e.g. 500').fill('100');
    await adminPage.getByRole('button', { name: /add deposit/i }).click();

    // Wait for the sheet to close (mutation success → onOpenChange(false)).
    // Then the hero card should display "100.00 EUR" (MoneyAmount renders
    // `${absFormatted}${currency ? ' ' + currency : ''}`, decimals=2 default).
    await expect(adminPage.getByText('100.00 EUR').first()).toBeVisible({ timeout: 10_000 });

    // ── 2. Withdraw 40 ─────────────────────────────────────────────────
    await adminPage.getByRole('button', { name: /^withdraw$/i }).click();
    await adminPage.getByPlaceholder('e.g. 500').fill('40');
    await adminPage.getByRole('button', { name: /add withdrawal/i }).click();

    // Balance now 60. The recent-activity panel also lists the new
    // withdrawal as "−40.00 EUR" but we anchor on the CURRENT BALANCE card
    // by matching the exact "60.00 EUR" hero string.
    await expect(adminPage.getByText('60.00 EUR').first()).toBeVisible({ timeout: 10_000 });

    // ── 3. Partner sees the same 60 ────────────────────────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/account');
    await partnerPage.waitForURL(/\/dashboard\/account/, { timeout: 10_000 });
    // Force a fresh fetch — `useJointAccountSummary` has a 2-minute staleTime,
    // so simply landing on the page may not re-issue the GET.
    await partnerPage.reload();
    await expect(partnerPage.getByText('60.00 EUR').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
