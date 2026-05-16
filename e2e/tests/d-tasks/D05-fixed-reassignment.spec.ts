/**
 * D05 — Fixed-mode reassignment: admin (creator) reassigns a task they
 * created from the partner back to themselves; the partner no longer sees
 * the task as assigned to them.
 *
 * PIN: commit `41db669` — `task.service.assignTask` was refactored so that
 * the "only the task creator can assign to another member" check is the
 * canonical rule for fixed-mode reassignment (the previous version had a
 * broader admin-OR-creator gate). This test is the canonical regression
 * pin for that rule: it exercises the path where the assigner IS the
 * creator (admin created the task) and is moving the task off the
 * partner. If the rule regresses and the API rejects with
 * `ForbiddenError('Only the task creator can assign this task to another
 * member')`, the reassignment fails and the partner still sees the task
 * as theirs.
 *
 * Flow:
 *   1. createCoupleHousehold({taskMethod: 'fixed'})
 *   2. Resolve admin + partner member-_ids via the household payload.
 *   3. Admin seeds the task assigned to the partner.
 *   4. Partner confirms it's visible as assigned to them.
 *   5. Admin reassigns via the API (PATCH /tasks/:id/assign with
 *      `{ assignedToMemberId: adminMemberId }`) — the FrontEnd's
 *      `AssignSelect` UI lives in `TasksPage.tsx` (line ~43), but
 *      driving the Radix Select reliably across browsers is brittle and
 *      this test pins the SERVER-SIDE rule, not the UI affordance.
 *   6. Partner reloads — the task is no longer marked "Assigned to <partner>".
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold, fetchHouseholdMembers } from '../../support/household';
import { seedTask } from '../../support/dataFactory';

const API_BASE = 'http://localhost:5001';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('D05 — fixed reassignment: admin reassigns task from partner to self; partner no longer sees it as theirs', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'fixed',
  });

  try {
    // ── 1. Resolve both member-_ids ────────────────────────────────────
    const members = await fetchHouseholdMembers(couple.adminToken, couple.household._id);
    const adminMember = members.find((m) => m.nickname === couple.admin.firstName);
    const partnerMember = members.find((m) => m.nickname === couple.partner.firstName);
    if (!adminMember || !partnerMember) {
      throw new Error('admin/partner member not found in household response');
    }

    // ── 2. Admin seeds the task assigned to partner ────────────────────
    const seeded = await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D05 reassignable task',
      assignedToMemberId: partnerMember._id,
    });

    // ── 3. Partner sees the task as theirs ──────────────────────────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/tasks');
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D05 reassignable task')).toBeVisible({ timeout: 10_000 });
    await partnerPage.getByText('D05 reassignable task').click();
    await expect(partnerPage.getByText(/Assigned to Partner/i).first()).toBeVisible({
      timeout: 5_000,
    });

    // ── 4. Admin reassigns the task back to themselves via the API ─────
    // Surprise documented: `task.service.assignTask` routes "self-assign"
    // (admin → admin) through an atomic findOneAndUpdate that REQUIRES
    // the task to currently be unassigned; the creator-overwrite branch
    // only handles "assign to another member". So reassigning from
    // partner to self is a two-step API call (unassign, then self-assign)
    // — which is exactly the path the `AssignSelect` Radix dropdown
    // takes when the user picks "Unassigned" and then their own row.
    // Self-assignment via PATCH .../assign with `{ assignedToMemberId:
    // adminMemberId }` directly fails with 400 "This task has already
    // been claimed" if the task is still pointed at the partner.
    const api = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${couple.adminToken}` },
    });
    try {
      const unassignRes = await api.patch(
        `/api/households/${couple.household._id}/tasks/${seeded._id}/assign`,
        { data: { assignedToMemberId: null } }
      );
      if (!unassignRes.ok()) {
        throw new Error(`unassign failed: ${unassignRes.status()} ${await unassignRes.text()}`);
      }
      const reassignRes = await api.patch(
        `/api/households/${couple.household._id}/tasks/${seeded._id}/assign`,
        { data: { assignedToMemberId: adminMember._id } }
      );
      if (!reassignRes.ok()) {
        throw new Error(`reassign failed: ${reassignRes.status()} ${await reassignRes.text()}`);
      }
    } finally {
      await api.dispose();
    }

    // ── 5. Partner reloads — task no longer marked as theirs ────────────
    await partnerPage.reload();
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D05 reassignable task')).toBeVisible({ timeout: 10_000 });
    await partnerPage.getByText('D05 reassignable task').click();
    // The "Assigned to Partner" detail is gone; the row now shows the
    // admin's nickname instead.
    await expect(partnerPage.getByText(/Assigned to Admin/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(partnerPage.getByText(/Assigned to Partner/i)).toHaveCount(0);
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
