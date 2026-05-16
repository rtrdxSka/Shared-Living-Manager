/**
 * D01 — Rotation setup: admin opens SetRotationDialog and configures the
 * cycle starting with themselves; the first task created afterwards shows
 * the admin as the current assignee on TasksPage.
 *
 * PIN: —
 *
 * Surprise documented: `createCoupleHousehold({taskMethod: 'rotation'})`
 * sets the *distribution method* on `household.settings`, but the rotation
 * `taskRotationConfig` itself is NOT auto-populated by onboarding (see
 * `BackEnd/src/services/household.service.ts` — the only writer of
 * `taskRotationConfig` is `taskService.setRotation`). So the admin must
 * open the SetRotationDialog and confirm before any rotation is effective.
 * Prior to that, the `RotationBanner` renders the empty-state "Set a
 * rotation to share tasks fairly" CTA.
 *
 * Flow:
 *   1. createCoupleHousehold({financeMode: 'split', taskMethod: 'rotation'})
 *   2. Admin opens /dashboard/tasks → clicks "Set rotation" in the banner.
 *   3. SetRotationDialog opens; defaults the select to the first task
 *      member (admin). Click Confirm.
 *   4. The rotation banner switches to the configured state showing the
 *      admin's nickname as the current rotation lead.
 *   5. Admin adds a task via the Add Task sheet. The TasksPage row picks
 *      up the auto-assigned admin (set inside `taskService.addTask` when
 *      `taskRotationConfig` exists).
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

test('D01 — admin configures rotation; first task shows admin as current assignee', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'rotation',
  });

  try {
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/tasks');
    await adminPage.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });

    // ── 1. Open the SetRotationDialog from the empty-state banner ─────
    const setRotationBtn = adminPage.getByRole('button', { name: /set rotation/i });
    await expect(setRotationBtn).toBeVisible({ timeout: 10_000 });
    await setRotationBtn.click();

    // Dialog appears (custom modal — not a Radix Dialog). The select
    // defaults to the first task member, which is the admin.
    await expect(adminPage.getByText(/configure rotation/i)).toBeVisible({ timeout: 5_000 });
    await adminPage.getByRole('button', { name: /^confirm$/i }).click();

    // ── 2. Banner flips to the configured state ───────────────────────
    await expect(adminPage.getByText(/'s week to lead the rotation/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(adminPage.getByText(/^ROTATION$/)).toBeVisible();

    // ── 3. Admin adds a task; the row picks up the auto-assignment ────
    // The collapsed page has TWO "Add task" buttons (header CTA + EmptyState
    // CTA — until we have any tasks). We click the header CTA (first).
    await adminPage.getByRole('button', { name: /^add task$/i }).first().click();
    await adminPage.getByPlaceholder(/clean bathroom/i).fill('D01 rotation task');
    // The sheet's submit button has title-case label "Add Task"; the
    // `name` matcher is case-insensitive but uniqueness comes from being
    // inside the just-opened sheet — pick the last to disambiguate from
    // the still-mounted header CTA.
    await adminPage.getByRole('button', { name: /^add task$/i }).last().click();

    // The TasksPage row is collapsed; the assignee surfaces via
    // `task.assignedToNickname` once the admin's id is on the task.
    // Expand the row to see the "Rotation: <admin nickname>" detail.
    await expect(adminPage.getByText('D01 rotation task')).toBeVisible({ timeout: 10_000 });
    await adminPage.getByText('D01 rotation task').click();
    await expect(adminPage.getByText(/Rotation: Admin/)).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
