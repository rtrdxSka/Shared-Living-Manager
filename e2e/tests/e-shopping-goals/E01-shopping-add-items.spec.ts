/**
 * E01 — Shopping list: admin adds 3 items via UI; partner sees all 3.
 *
 * PIN: —
 *
 * Flow (split-mode couple household):
 *   1. createCoupleHousehold({financeMode: 'split'}).
 *   2. Admin opens /dashboard/shopping-list → clicks "Add item" → fills the
 *      AddShoppingItemForm sheet → submits. Repeats three times.
 *   3. Partner opens /dashboard/shopping-list; assert all three item names are
 *      visible.
 *
 * Surprises documented:
 *   - The page route is `/dashboard/shopping-list` (confirmed in
 *     `FrontEnd/src/App.tsx`).
 *   - `AddShoppingItemForm` is a Sheet (right-side overlay). The first input
 *     in the sheet is "Name" (id `shop-name`); category defaults to
 *     `groceries` so we don't need to touch the Select. The submit button is
 *     "Add item" (case-insensitive). The same label is used by the header
 *     CTA, so we anchor the form submit by `.last()` to disambiguate.
 *   - The category badge for "groceries" renders the label "Groceries" via
 *     EXPENSE_TYPE_LABELS — irrelevant to this test but worth noting.
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

test('E01 — admin adds 3 shopping items via UI; partner sees all 3', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  const itemNames = ['E01 milk', 'E01 bread', 'E01 eggs'];

  try {
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/shopping-list');
    await adminPage.waitForURL(/\/dashboard\/shopping/, { timeout: 10_000 });

    for (const name of itemNames) {
      // Header CTA opens the AddShoppingItemForm sheet.
      await adminPage.getByRole('button', { name: /^add item$/i }).first().click();

      // Fill the Name input (id="shop-name"). Category defaults to groceries.
      await adminPage.locator('#shop-name').fill(name);

      // The sheet's submit button label is "Add item". Both the header CTA
      // and the sheet submit share the label, so `.last()` selects the one
      // inside the just-opened sheet.
      await adminPage.getByRole('button', { name: /^add item$/i }).last().click();

      // Wait for the row to appear before adding the next — the sheet closes
      // on successful submit (`onOpenChange(false)` in the form).
      await expect(adminPage.getByText(name)).toBeVisible({ timeout: 10_000 });
    }

    // Partner sees all three items in their own context.
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/shopping-list');
    await partnerPage.waitForURL(/\/dashboard\/shopping/, { timeout: 10_000 });

    for (const name of itemNames) {
      await expect(partnerPage.getByText(name)).toBeVisible({ timeout: 10_000 });
    }
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
