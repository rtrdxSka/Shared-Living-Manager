/**
 * E03 — Shopping list "Done shopping" flow creates an expense visible on
 * /dashboard/expenses.
 *
 * PIN: —
 *
 * Flow (split-mode couple household):
 *   1. createCoupleHousehold({financeMode: 'split'}).
 *   2. Seed 2 items via API as admin.
 *   3. Admin opens /dashboard/shopping-list, checks BOTH items (the "Done
 *      shopping" CTA only appears when `boughtItems.length > 0`).
 *   4. Admin clicks "Done shopping (2)" → DoneShoppingDialog opens.
 *   5. Admin clicks "Open expense form" → AddExpenseForm Sheet opens with a
 *      prefilled description (grouped by category) and the dominant category
 *      selected. The amount field is BLANK and must be filled by the user.
 *   6. Admin fills amount `40` and clicks "Add Expense".
 *   7. The expense lands on /dashboard/expenses (admin context).
 *
 * Surprises documented:
 *   - DoneShoppingDialog itself has NO total / store / notes inputs — it is
 *     a confirmation modal whose primary action is "Open expense form".
 *     The actual total entry happens in AddExpenseForm, which appears on
 *     top of the DoneShoppingDialog. Plan accordingly: the test fills the
 *     total in AddExpenseForm, not in DoneShoppingDialog.
 *   - AddExpenseForm's prefilled description is a long string of grouped
 *     item names (per `buildPrefillFromBought` in ShoppingListPage.tsx).
 *     We DO NOT assert the exact description text — we anchor on the amount
 *     so the test is robust to copy changes in the prefill builder. We use
 *     a distinctive amount (`40.00 EUR`) for the post-create assertion.
 *   - The form's submit button is labelled "Add Expense" (title-case).
 *   - The auto-archive step (`archiveBought`) runs on `onCreated` of the
 *     form, removing the checked items from the active list — this is a
 *     side effect we don't assert on (the test scope is "expense visible on
 *     /dashboard/expenses").
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedShoppingItem } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('E03 — admin completes shopping flow; expense appears on /dashboard/expenses', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  const items = ['E03 milk', 'E03 bread'];

  try {
    // ── 1. Seed 2 items via API ───────────────────────────────────────────
    for (const name of items) {
      await seedShoppingItem({
        token: couple.adminToken,
        householdId: couple.household._id,
        name,
      });
    }

    // ── 2. Admin checks both items, then opens DoneShoppingDialog ─────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/shopping-list');
    await adminPage.waitForURL(/\/dashboard\/shopping-list/, { timeout: 10_000 });

    for (const name of items) {
      const checkbox = adminPage.getByLabel(`Mark ${name} as bought`);
      await expect(checkbox).toBeVisible({ timeout: 10_000 });
      await checkbox.check();
      await expect(checkbox).toBeChecked({ timeout: 10_000 });
    }

    // The "Done shopping (N)" button is gated on hasBought — it appears once
    // at least one item is checked. We use a regex to match the variable
    // count suffix.
    const doneBtn = adminPage.getByRole('button', { name: /^done shopping/i });
    await expect(doneBtn).toBeVisible({ timeout: 10_000 });
    await doneBtn.click();

    // ── 3. Click "Open expense form" in the dialog ────────────────────────
    await expect(adminPage.getByText(/done shopping\?/i)).toBeVisible({ timeout: 5_000 });
    await adminPage.getByRole('button', { name: /open expense form/i }).click();

    // ── 4. Fill the amount in AddExpenseForm and submit ───────────────────
    // The AddExpenseForm sheet renders with a prefilled description and a
    // blank Amount input. Anchor the amount by placeholder "0.00".
    const amountInput = adminPage.getByPlaceholder('0.00');
    await expect(amountInput).toBeVisible({ timeout: 10_000 });
    await amountInput.fill('40');

    await adminPage.getByRole('button', { name: /^add expense$/i }).click();

    // ── 5. Navigate to /dashboard/expenses and assert the expense exists ──
    await adminPage.goto('/dashboard/expenses');
    await adminPage.waitForURL(/\/dashboard\/expenses/, { timeout: 10_000 });

    // The amount renders as `40.00 EUR` per MoneyAmount. Currency confirmed
    // in B05/B06 and Group D notes.
    await expect(adminPage.getByText('40.00 EUR').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
