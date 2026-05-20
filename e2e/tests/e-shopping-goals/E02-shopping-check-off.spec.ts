/**
 * E02 — Shopping list: seed 3 items via API as admin; partner checks 2 of
 * them via UI; admin (after a reload) sees the 2 checked + 1 unchecked.
 *
 * PIN: —
 *
 * Flow (split-mode couple household):
 *   1. createCoupleHousehold({financeMode: 'split'}).
 *   2. Seed 3 items via `seedShoppingItem` (API) — faster + more deterministic
 *      than driving the AddShoppingItemForm three times.
 *   3. Partner opens /dashboard/shopping-list → checks the two named items
 *      using the native `<input type="checkbox">` (NOT a Radix Checkbox —
 *      `ShoppingListView.tsx` line ~48). Each checkbox has
 *      `aria-label="Mark {name} as bought"`.
 *   4. Admin reloads /dashboard/shopping-list and observes the same checked/
 *      unchecked state across both contexts (per-context React Query cache).
 *
 * Surprises documented:
 *   - The checkbox is a native `<input type="checkbox">`; Playwright's
 *     `isChecked()` works on it directly. Anchor by `aria-label` to scope
 *     to the right row.
 *   - The "checked" pill (line-through on text) is purely cosmetic — the
 *     authoritative signal is `input.isChecked()` (or `checked` attribute).
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

test('E02 — partner checks 2 of 3 seeded items; admin sees mirrored state after reload', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  const items = ['E02 milk', 'E02 bread', 'E02 eggs'];
  const itemsToCheck = ['E02 milk', 'E02 bread'];
  const itemsLeftUnchecked = ['E02 eggs'];

  try {
    // ── 1. Seed 3 items via API as admin ──────────────────────────────────
    for (const name of items) {
      await seedShoppingItem({
        token: couple.adminToken,
        householdId: couple.household._id,
        name,
      });
    }

    // ── 2. Partner checks off 2 of them via UI ────────────────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/shopping-list');
    await partnerPage.waitForURL(/\/dashboard\/shopping-list/, { timeout: 10_000 });

    for (const name of itemsToCheck) {
      const checkbox = partnerPage.getByLabel(`Mark ${name} as bought`);
      await expect(checkbox).toBeVisible({ timeout: 10_000 });
      await checkbox.check();
      await expect(checkbox).toBeChecked({ timeout: 10_000 });
    }

    // Sanity: the third checkbox is NOT checked in the partner's context.
    for (const name of itemsLeftUnchecked) {
      await expect(partnerPage.getByLabel(`Mark ${name} as bought`)).not.toBeChecked();
    }

    // ── 3. Admin reloads and sees the mirrored state ──────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/shopping-list');
    await adminPage.waitForURL(/\/dashboard\/shopping-list/, { timeout: 10_000 });

    for (const name of itemsToCheck) {
      await expect(adminPage.getByLabel(`Mark ${name} as bought`)).toBeChecked({
        timeout: 10_000,
      });
    }
    for (const name of itemsLeftUnchecked) {
      await expect(adminPage.getByLabel(`Mark ${name} as bought`)).not.toBeChecked();
    }
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
