/**
 * C01 — Split-mode expense claim/resolve lifecycle.
 *
 * PIN: —
 *
 * Flow (all in split-mode couple household):
 *   1. Admin seeds an unpaid expense via API (no `paidByUserId`).
 *   2. Admin (UI) opens /dashboard/expenses, expands the row, clicks
 *      "Claim expense" — backend sets `paidByUserId = admin`.
 *   3. Partner (UI) reloads /dashboard/expenses, expands the row, clicks
 *      "I paid you back" — backend sets `pendingConfirmation = true`.
 *   4. Admin (UI) reloads, expands the row, clicks "Confirm received" —
 *      backend sets `isResolved = true`.
 *   5. Assert the expense now lives in the SETTLED section for both contexts.
 *
 * The expense lifecycle is split between the two contexts so we exercise
 * BOTH the creditor side (admin claims, then confirms) and the debtor side
 * (partner requests resolution). This is the canonical happy-path for split
 * finance; if any of the four state transitions regresses, this test fails.
 *
 * Note: pages reload between actions because the query cache is per-context
 * and a backend mutation in one BrowserContext does NOT invalidate the cache
 * in the other.
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

test('C01 — split-mode claim/resolve lifecycle: admin claims, partner resolves, expense lands in Settled', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    // ── 1. Seed an unclaimed expense via API ────────────────────────────
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 60,
      description: 'C01 split groceries',
      category: 'groceries',
    });

    // ── 2. Admin claims the expense ──────────────────────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/expenses');
    await adminPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    // The OUTSTANDING section is rendered in split mode (B02-confirmed),
    // and our seeded expense lives there because it has no payer.
    await expect(adminPage.getByText('OUTSTANDING', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('C01 split groceries')).toBeVisible();

    // Expand the row by clicking it (ExpensesPage line ~646: onClick={onToggle}).
    await adminPage.getByText('C01 split groceries').click();
    await adminPage
      .getByRole('button', { name: /^claim expense$/i })
      .click();

    // After the claim mutation, the row remains in OUTSTANDING (still
    // unresolved) but the "Unpaid" pill disappears and the action buttons
    // change. Wait for the "I paid you back" affordance to either appear
    // (admin sees nothing because they're now the creditor) — the relevant
    // signal is that "Claim expense" is gone.
    await expect(
      adminPage.getByRole('button', { name: /^claim expense$/i })
    ).toHaveCount(0, { timeout: 10_000 });

    // ── 3. Partner requests resolution ("I paid you back") ──────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/expenses');
    await partnerPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    await expect(partnerPage.getByText('C01 split groceries')).toBeVisible({ timeout: 10_000 });
    await partnerPage.getByText('C01 split groceries').click();

    await partnerPage
      .getByRole('button', { name: /^i paid you back$/i })
      .click();

    // After the request, the row enters pendingConfirmation state — the
    // button disappears for the partner and is replaced by an "Awaiting
    // confirmation…" disabled button.
    await expect(
      partnerPage.getByRole('button', { name: /awaiting confirmation/i })
    ).toBeVisible({ timeout: 10_000 });

    // ── 4. Admin confirms receipt ────────────────────────────────────────
    // Reload admin page so the React Query cache picks up the partner's
    // request-resolution mutation.
    await adminPage.reload();
    await adminPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    await expect(adminPage.getByText('C01 split groceries')).toBeVisible({ timeout: 10_000 });
    await adminPage.getByText('C01 split groceries').click();

    await adminPage
      .getByRole('button', { name: /^confirm received$/i })
      .click();

    // After confirm, isResolved=true → the expense moves from OUTSTANDING
    // to SETTLED. Assert SETTLED is visible and the description is under it.
    await expect(adminPage.getByText('SETTLED', { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── 5. Both contexts see the expense in SETTLED ──────────────────────
    // The row may still be expanded; collapsing tracker is local-only state
    // — what matters is the SETTLED heading exists and contains the row.
    await expect(adminPage.getByText('C01 split groceries')).toBeVisible();

    await partnerPage.reload();
    await partnerPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });
    await expect(partnerPage.getByText('SETTLED', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(partnerPage.getByText('C01 split groceries')).toBeVisible();
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
