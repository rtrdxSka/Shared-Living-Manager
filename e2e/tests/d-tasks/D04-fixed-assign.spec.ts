/**
 * D04 — Fixed mode: admin creates a task assigned to the partner; the
 * partner sees that task assigned to them.
 *
 * PIN: —
 *
 * Flow:
 *   1. createCoupleHousehold({taskMethod: 'fixed'})
 *   2. Fetch members to get the partner's subdocument `_id` (NOT userId —
 *      the API takes `assignedToMemberId`, which is the member-_id;
 *      confirmed in `task.service.addTask`).
 *   3. Admin seeds the task via API with `assignedToMemberId = partnerMemberId`.
 *   4. Partner reloads /dashboard/tasks; the row shows the partner's
 *      nickname as the assignee in the collapsed-row avatar and, when
 *      expanded, the "Assigned to Partner" detail.
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold, fetchHouseholdMembers } from '../../support/household';
import { seedTask } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('D04 — fixed mode: admin assigns task to partner; partner sees it as assigned to them', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'fixed',
  });

  try {
    // ── 1. Resolve partner's member-_id via the household payload ──────
    const members = await fetchHouseholdMembers(couple.adminToken, couple.household._id);
    const partnerMember = members.find((m) => m.nickname === couple.partner.firstName);
    if (!partnerMember) throw new Error('partner member not found in household response');

    // ── 2. Admin seeds the task assigned to the partner ────────────────
    await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D04 partner task',
      assignedToMemberId: partnerMember._id,
    });

    // ── 3. Partner sees the task as assigned to them ───────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/tasks');
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D04 partner task')).toBeVisible({ timeout: 10_000 });

    // The "Up for grabs" pill is the unassigned marker; assert it's NOT
    // present on this row.
    await expect(partnerPage.getByText(/up for grabs/i)).toHaveCount(0);

    // Expand the row and confirm the assignment detail.
    await partnerPage.getByText('D04 partner task').click();
    await expect(partnerPage.getByText(/Assigned to Partner/i).first()).toBeVisible({
      timeout: 5_000,
    });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
