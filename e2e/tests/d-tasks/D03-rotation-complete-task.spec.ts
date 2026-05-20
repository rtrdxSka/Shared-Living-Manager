/**
 * D03 — Rotation: current assignee completes a task; partner observes the
 * checked/completed state.
 *
 * PIN: —
 *
 * Flow:
 *   1. createCoupleHousehold({taskMethod: 'rotation'})
 *   2. Admin configures rotation (admin first → admin is current).
 *   3. Admin creates a task; rotation auto-assigns it to admin.
 *   4. Admin (UI) clicks the inline checkbox on the row → backend sets
 *      `isCompleted: true`. The row's title strikes through; the
 *      "Mark as done" button (visible only when expanded) is irrelevant
 *      to this test — the checkbox path is the canonical one.
 *   5. Partner (UI, fresh page) sees the same task with line-through styling
 *      and the "Done by Admin" pill. The `Task` document is single-source
 *      so any per-context React Query staleness flips after `reload()`.
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

test('D03 — rotation: admin completes task; partner sees the completed state', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'rotation',
  });

  try {
    // ── 1. Admin configures rotation (defaults to admin first) ─────────
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/tasks');
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: /set rotation/i }).click();
    await expect(adminPage.getByText(/configure rotation/i)).toBeVisible({ timeout: 5_000 });
    await adminPage.getByRole('button', { name: /^confirm$/i }).click();
    await expect(adminPage.getByText(/'s week to lead the rotation/i)).toBeVisible({
      timeout: 10_000,
    });

    // ── 2. Seed a task (via API; rotation will auto-assign to admin) ────
    await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D03 dishes',
    });
    await adminPage.reload();
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(adminPage.getByText('D03 dishes')).toBeVisible({ timeout: 10_000 });

    // ── 3. Admin clicks the row's checkbox to toggle complete ──────────
    // The checkbox is rendered as `role="checkbox"` with `aria-checked`.
    const adminCheckbox = adminPage.getByRole('checkbox').first();
    await expect(adminCheckbox).toHaveAttribute('aria-checked', 'false');
    await adminCheckbox.click();
    await expect(adminCheckbox).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });

    // ── 4. Partner reloads and sees the same completed state ───────────
    // Surprise documented: TaskRow renders the checkbox as a static
    // <span> (no role) once the task is completed AND the viewer is not
    // the completer — the "canUndo" gate eliminates the interactive
    // checkbox. So we cannot use `getByRole('checkbox')` on the
    // partner's side. We assert the cross-context state via the
    // "Done by <nickname>" pill (rendered when `task.isCompleted &&
    // task.completedByNickname`) and the section heading
    // "DONE THIS WEEK" — both produced exclusively by the
    // `task.isCompleted` branch.
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/tasks');
    await partnerPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
    await expect(partnerPage.getByText('D03 dishes')).toBeVisible({ timeout: 10_000 });
    await expect(partnerPage.getByText(/Done by Admin/i)).toBeVisible({ timeout: 5_000 });
    await expect(partnerPage.getByText(/^DONE THIS WEEK$/)).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
