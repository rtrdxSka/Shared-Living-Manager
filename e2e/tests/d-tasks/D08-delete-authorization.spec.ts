/**
 * D08 — Task delete authorization: a non-creator non-admin (the partner)
 * sees no delete control on the admin's task; the admin can delete it and
 * the row disappears for both.
 *
 * PIN: —
 *
 * The UI gate lives in `TasksPage.tsx` `TaskRow` (`canDelete = isAdmin ||
 * task.createdByUserId === currentUserId`). The server gate lives in
 * `task.service.deleteTask` — `ForbiddenError('You can only delete tasks
 * you created')` for non-admins/non-creators.
 *
 * Note: the household helper's admin is also THE household admin (role:
 * 'owner'/'admin' assigned at creation), so the only role that lacks
 * delete authority here is the partner. The flip side — admin deletes a
 * partner-created task — is implicitly covered by the admin-gate but
 * NOT exercised here; this test pins the absence of control for the
 * non-creator non-admin specifically.
 *
 * Delete is a two-step inline confirmation: first click opens "Delete
 * this task?" / "Yes, delete" / "Cancel" — no separate Dialog component.
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

test('D08 — delete authorization: partner sees no Delete on admin task; admin deletes; row gone for both', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'fixed',
  });

  try {
    // ── 1. Admin seeds a task (no assignee — irrelevant for this test) ──
    await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D08 admin-owned task',
    });

    // ── 2. Partner expands the row and sees no Delete control ──────────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/tasks');
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D08 admin-owned task')).toBeVisible({ timeout: 10_000 });
    await partnerPage.getByText('D08 admin-owned task').click();

    // The "Mark as done" button IS visible (any task-member can complete
    // a task) — assert that to prove the row IS expanded, then assert
    // Delete is absent.
    await expect(
      partnerPage.getByRole('button', { name: /^mark as done$/i })
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      partnerPage.getByRole('button', { name: /^delete task$/i })
    ).toHaveCount(0);

    // ── 3. Admin expands the same row and sees Delete ───────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/tasks');
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(adminPage.getByText('D08 admin-owned task')).toBeVisible({ timeout: 10_000 });
    await adminPage.getByText('D08 admin-owned task').click();

    const deleteBtn = adminPage.getByRole('button', { name: /^delete task$/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });

    // ── 4. Two-step confirm → click "Yes, delete" ───────────────────────
    await deleteBtn.click();
    const confirmBtn = adminPage.getByRole('button', { name: /^yes, delete$/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // ── 5. Row disappears for admin; reload partner — gone for them too ─
    await expect(adminPage.getByText('D08 admin-owned task')).toHaveCount(0, { timeout: 10_000 });

    await partnerPage.reload();
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D08 admin-owned task')).toHaveCount(0, { timeout: 10_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
