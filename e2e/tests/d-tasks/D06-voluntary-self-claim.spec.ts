/**
 * D06 — Voluntary distribution: partner claims an unassigned task via the
 * UI; both contexts then see the partner as the assignee.
 *
 * PIN: —
 *
 * Flow:
 *   1. createCoupleHousehold({taskMethod: 'voluntary'})
 *   2. Seed an unassigned task via the API.
 *   3. Partner navigates to /dashboard/tasks, expands the row, and clicks
 *      "Claim this task" (the ClaimButton in `TasksPage.tsx` voluntary
 *      branch). Backend atomically sets `assignedToMemberId = partner._id`.
 *   4. After the click the button flips to "Unclaim (assigned to Partner)".
 *   5. Admin reloads → the row no longer shows the "Up for grabs" pill
 *      and the "Claimed by Partner" label is visible inside the expanded
 *      panel (admin sees the partner's name; their ClaimButton renders
 *      the "Claimed by" sibling instead of the button).
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedTask } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('D06 — voluntary: partner claims unassigned task; admin sees the same assignee', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'voluntary',
  });

  try {
    // ── 1. Admin seeds an unassigned task ──────────────────────────────
    await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D06 voluntary task',
    });

    // ── 2. Partner opens the page and claims the task ──────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/tasks');
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D06 voluntary task')).toBeVisible({ timeout: 10_000 });

    // The "Up for grabs" pill is visible on the collapsed row.
    await expect(partnerPage.getByText(/up for grabs/i)).toBeVisible();

    // Expand and click "Claim this task".
    await partnerPage.getByText('D06 voluntary task').click();
    const claimBtn = partnerPage.getByRole('button', { name: /^claim this task$/i });
    await expect(claimBtn).toBeVisible({ timeout: 5_000 });
    await claimBtn.click();

    // After claim, the button flips to "Unclaim (assigned to Partner)".
    await expect(
      partnerPage.getByRole('button', { name: /^unclaim \(assigned to Partner\)$/i })
    ).toBeVisible({ timeout: 5_000 });

    // ── 3. Admin reloads and observes the same state ───────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/tasks');
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(adminPage.getByText('D06 voluntary task')).toBeVisible({ timeout: 10_000 });

    // "Up for grabs" is gone for the admin's view of this row.
    await expect(adminPage.getByText(/up for grabs/i)).toHaveCount(0);

    // Expand the row and assert the "Claimed by Partner" label.
    await adminPage.getByText('D06 voluntary task').click();
    await expect(adminPage.getByText(/Claimed by Partner/i)).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
