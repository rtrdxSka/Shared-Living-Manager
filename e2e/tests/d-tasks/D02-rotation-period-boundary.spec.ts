/**
 * D02 — Rotation period boundary: backdating `taskRotationConfig.startedAt`
 * by 8 days (one period > 7-day cycle) flips the current assignee from the
 * admin to the partner.
 *
 * PIN: —
 *
 * Math (from `taskService.computeRotationStatus`):
 *   elapsed = Date.now() - startedAt
 *   currentIndex = floor(elapsed / (periodDays * 86_400_000))
 *   currentMember = orderedMemberIds[currentIndex % orderedMemberIds.length]
 *
 * After `setRotation(adminMemberId)` the ordered list begins with the admin,
 * so `currentIndex = 0` → admin is current. `fastForwardRotation(8)`
 * backdates `startedAt` by 8 days, so `currentIndex = 1` → partner.
 *
 * Note: the task row's `assignedToNickname` is computed at creation time
 * from the rotation status of THAT moment. Pre-existing tasks therefore
 * keep the admin's nickname even after a backdate. The rotation BANNER,
 * which derives its label from the listTasks-attached `rotation` block
 * (recomputed on every read), is what flips.
 *
 * The end-to-end check: after the backdate + reload, the rotation banner
 * reads "<partner>'s week to lead the rotation" and the new task created
 * after the backdate is assigned to the partner.
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { fastForwardRotation, seedTask } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('D02 — rotation period boundary: backdate 8 days flips the current assignee', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'rotation',
  });

  try {
    // ── 1. Admin configures the rotation (admin first) ─────────────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/tasks');
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: /set rotation/i }).click();
    await expect(adminPage.getByText(/configure rotation/i)).toBeVisible({ timeout: 5_000 });
    await adminPage.getByRole('button', { name: /^confirm$/i }).click();

    // Banner now shows admin as current. The banner uses an <em> for the
    // current member's nickname; assert the rendered string contains
    // "Admin's week" via a single visible regex on the banner copy.
    await expect(
      adminPage.getByText(/Admin's week to lead the rotation/i)
    ).toBeVisible({ timeout: 10_000 });

    // ── 2. Backdate startedAt by 8 days (1 period elapsed) ─────────────
    await fastForwardRotation(couple.household._id, 8);

    // ── 3. Reload → rotation banner now identifies partner as current ──
    await adminPage.reload();
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(
      adminPage.getByText(/Partner's week to lead the rotation/i)
    ).toBeVisible({ timeout: 10_000 });

    // ── 4. New task created post-backdate auto-assigns to partner ──────
    await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D02 post-rotation task',
    });

    await adminPage.reload();
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(adminPage.getByText('D02 post-rotation task')).toBeVisible({ timeout: 10_000 });
    await adminPage.getByText('D02 post-rotation task').click();
    await expect(adminPage.getByText(/Rotation: Partner/)).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
