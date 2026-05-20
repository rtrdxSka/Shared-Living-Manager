/**
 * E04 — Goal: admin creates a 500 EUR goal via UI; partner contributes
 * 100 EUR; both contexts see 20% progress.
 *
 * PIN: —
 *
 * Flow (split-mode couple household):
 *   1. createCoupleHousehold({financeMode: 'split'}).
 *   2. Admin opens /dashboard/goals → clicks "Add Goal" → AddGoalForm Sheet
 *      opens → fills Name = 'E04 Vacation' and target amount '500' → submits.
 *   3. The new goal renders an "Active goals" card with 0% progress; the
 *      "+ Add contribution" ghost button is the partner's affordance.
 *   4. Partner opens /dashboard/goals → finds the goal card → clicks
 *      "+ Add contribution" → AddContributionDialog Sheet opens → fills
 *      amount '100' → submits.
 *   5. Both admin (after reload) and partner contexts see `Saved 20% of
 *      target` in the goal card footer.
 *
 * Surprises documented:
 *   - The "Add Goal" header CTA and the dashed "+ Add goal" placeholder
 *     card both open the same AddGoalForm Sheet (DashboardContext owns the
 *     open state). The header button label is "Add Goal" (title-case) per
 *     GoalsPage.tsx line ~334.
 *   - AddGoalForm's submit button is labelled "Add Goal" (same string as
 *     the header CTA). Anchor by `.last()` to pick the sheet submit.
 *   - AddContributionDialog's submit button is "Add Contribution".
 *   - Progress text is `Saved {pct}% of target` per `computeGoalProgress`
 *     (FrontEnd/src/utils/dashboardHelpers.ts) and GoalCard line ~152.
 *     100/500 = 20% (rounded).
 *   - The admin context's React Query cache is independent from the
 *     partner's, so admin needs `page.reload()` to see the 20% update.
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

test('E04 — admin creates 500 EUR goal; partner contributes 100; both see 20% progress', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  const goalName = 'E04 Vacation';

  try {
    // ── 1. Admin creates the goal via UI ──────────────────────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/goals');
    await adminPage.waitForURL(/\/dashboard\/goals/, { timeout: 10_000 });

    await adminPage.getByRole('button', { name: /^add goal$/i }).first().click();

    // AddGoalForm renders inside a Sheet. Fill Name + Target Amount.
    await adminPage.getByPlaceholder(/summer vacation/i).fill(goalName);
    // The target-amount input is type=number with placeholder 'e.g. 3000'.
    await adminPage.getByPlaceholder('e.g. 3000').fill('500');

    // Sheet submit button has the same "Add Goal" label as the header CTA;
    // disambiguate by picking the LAST occurrence (inside the sheet).
    await adminPage.getByRole('button', { name: /^add goal$/i }).last().click();

    // Goal card appears. The sheet closes via `onOpenChange(false)`.
    await expect(adminPage.getByText(goalName)).toBeVisible({ timeout: 10_000 });

    // Sanity: initial progress is 0% — `Saved 0% of target` is rendered.
    await expect(adminPage.getByText(/saved\s+0%\s+of target/i)).toBeVisible({
      timeout: 5_000,
    });

    // ── 2. Partner contributes 100 via UI ────────────────────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/goals');
    await partnerPage.waitForURL(/\/dashboard\/goals/, { timeout: 10_000 });
    await expect(partnerPage.getByText(goalName)).toBeVisible({ timeout: 10_000 });

    // The "+ Add contribution" ghost button is rendered inside each active
    // goal card. With one active goal it's unique by name.
    await partnerPage.getByRole('button', { name: /add contribution/i }).first().click();

    // AddContributionDialog Sheet opens. Fill the amount.
    await partnerPage.getByPlaceholder('e.g. 100').fill('100');
    // Submit button label is "Add Contribution".
    await partnerPage.getByRole('button', { name: /^add contribution$/i }).last().click();

    // Partner sees 20% progress.
    await expect(partnerPage.getByText(/saved\s+20%\s+of target/i)).toBeVisible({
      timeout: 10_000,
    });

    // ── 3. Admin reloads and sees 20% too ─────────────────────────────────
    await adminPage.reload();
    await adminPage.waitForURL(/\/dashboard\/goals/, { timeout: 10_000 });
    await expect(adminPage.getByText(/saved\s+20%\s+of target/i)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
