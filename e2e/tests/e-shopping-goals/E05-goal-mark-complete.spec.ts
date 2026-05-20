/**
 * E05 — Goal: seed an active goal at ~100% via API; admin marks it complete
 * via UI; the card moves from the Active section to the Completed section.
 *
 * PIN: —
 *
 * Surprise documented (and the reason the seeded contribution is 499/500,
 * NOT 500/500 as the literal spec text suggested):
 *   `goal.service.ts addContribution` auto-completes the goal when the
 *   cumulative contribution amount is `>= goal.targetAmount` (line ~161).
 *   So contributing the full target via API would leave the goal already
 *   `status = 'completed'`, with no opportunity for the admin to click the
 *   "Mark completed" button on the UI. To exercise the manual-completion
 *   path the test contributes 499 of a 500 target — `pct` rounds to 100
 *   (the GoalCard's gate `isActive && pct >= 100` flips on, surfacing the
 *   button) while `status` stays `'active'`.
 *
 * Flow (split-mode couple household):
 *   1. createCoupleHousehold({financeMode: 'split'}).
 *   2. seedGoal({ name, targetAmount: 500 }) via API as admin.
 *   3. seedGoalContribution({ amount: 499 }) via API — status stays active,
 *      pct rounds to 100.
 *   4. Admin opens /dashboard/goals → asserts goal is under ACTIVE GOALS →
 *      clicks "Mark completed" (the button only appears when pct >= 100 and
 *      goal is active, per GoalsPage.tsx GoalCard line ~226).
 *   5. Asserts the COMPLETED section appears (only rendered when
 *      `completedGoals.length > 0`) and contains the goal card.
 *
 * Surprises documented:
 *   - The Active vs Completed grouping is purely UI-side (filtered from the
 *     same `goals` array per status). When a card transitions, the ACTIVE
 *     section may keep an "Add goal" placeholder card visible (per
 *     GoalsPage.tsx line ~371 — the placeholder is always present).
 *   - The COMPLETED `<section>` only renders when there's at least one
 *     completed goal; pre-toggle there is no `COMPLETED` heading.
 *   - The "Mark completed" button label is exactly "Mark completed"
 *     (sentence case in the JSX, no period).
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedGoal, seedGoalContribution } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('E05 — admin marks an almost-complete goal as completed; card moves to Completed section', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  const goalName = 'E05 Emergency fund';

  try {
    // ── 1. Seed an active goal at 499/500 (pct rounds to 100) ─────────────
    const goal = await seedGoal({
      token: couple.adminToken,
      householdId: couple.household._id,
      name: goalName,
      targetAmount: 500,
    });

    const contribResult = await seedGoalContribution({
      token: couple.adminToken,
      householdId: couple.household._id,
      goalId: goal._id,
      amount: 499,
    });
    expect(contribResult.status).toBe('active');

    // ── 2. Admin opens /dashboard/goals ───────────────────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/goals');
    await adminPage.waitForURL(/\/dashboard\/goals/, { timeout: 10_000 });

    // ACTIVE GOALS section is rendered (count is at least 1).
    await expect(adminPage.getByText(/^ACTIVE GOALS$/)).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(goalName)).toBeVisible({ timeout: 10_000 });

    // Pre-toggle: no COMPLETED section exists yet.
    await expect(adminPage.getByText(/^COMPLETED$/)).toHaveCount(0);

    // ── 3. Click "Mark completed" ─────────────────────────────────────────
    const markBtn = adminPage.getByRole('button', { name: /^mark completed$/i });
    await expect(markBtn).toBeVisible({ timeout: 10_000 });
    await markBtn.click();

    // ── 4. COMPLETED section appears with the goal card ───────────────────
    await expect(adminPage.getByText(/^COMPLETED$/)).toBeVisible({ timeout: 10_000 });

    // The goal card itself stays in the DOM but is now grouped under the
    // COMPLETED section — anchor by the goal name appearing AFTER the
    // COMPLETED heading. (Using `getByText` for the name still passes
    // because the name is unique.)
    await expect(adminPage.getByText(goalName)).toBeVisible();

    // The "Mark completed" button should disappear (the gate
    // `isActive && pct >= 100` is now false because `isActive` is false).
    await expect(adminPage.getByRole('button', { name: /^mark completed$/i })).toHaveCount(0);
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
