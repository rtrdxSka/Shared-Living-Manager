/**
 * D07 — Voluntary claim race: two contexts press "Claim this task" on the
 * SAME unassigned task within the same `Promise.all` tick. Exactly one
 * succeeds; the loser sees the inline `role="alert"` error.
 *
 * PIN: task-assignment atomic claim — `task.service.assignTask` self-claim
 * branch uses
 *   Task.findOneAndUpdate({
 *     _id, householdId,
 *     $or: [{ assignedToMemberId: { $exists: false } }, { assignedToMemberId: null }],
 *   }, { $set: { assignedToMemberId } }, { new: true })
 * and throws `BadRequestError('This task has already been claimed')` when
 * the update returns null. If the conditional update regresses to a
 * read-modify-write or to an unconditional update, both concurrent claims
 * would succeed and the second would overwrite the first — this test is the
 * canonical regression pin for that fix.
 *
 * Mirrors C02's pattern (concurrent expense claim race). The loser's page
 * surfaces the error via TasksPage's `actionError` state — populated by
 * `extractApiError` in the `handleAssign` callback — which renders a
 * `role="alert"` inline alert near the top of the list.
 */
import { test, expect, type Page, type APIResponse } from '@playwright/test';

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

async function openClaimReady(page: Page, title: string): Promise<void> {
  await page.goto('/dashboard/tasks');
  await page.waitForURL(/\/dashboard\/tasks/, { timeout: 10_000 });
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
  // Expand the row so the Claim button is in the DOM.
  await page.getByText(title).click();
  await expect(
    page.getByRole('button', { name: /^claim this task$/i })
  ).toBeVisible({ timeout: 5_000 });
}

test('D07 — voluntary concurrent claims: exactly one 2xx, exactly one 4xx; loser sees inline alert', async ({ browser }) => {
  const couple = await createCoupleHousehold({
    browser,
    financeMode: 'split',
    taskMethod: 'voluntary',
  });

  try {
    const seeded = await seedTask({
      token: couple.adminToken,
      householdId: couple.household._id,
      title: 'D07 claim race task',
    });

    const adminPage = await couple.adminContext.newPage();
    const partnerPage = await couple.partnerContext.newPage();

    await Promise.all([
      openClaimReady(adminPage, 'D07 claim race task'),
      openClaimReady(partnerPage, 'D07 claim race task'),
    ]);

    // Both contexts hit the same backend URL; the response promise has to
    // be anchored on the Page, not the URL.
    const assignUrlMatch = (url: string): boolean =>
      url.includes(`/tasks/${seeded._id}/assign`);

    const adminResponse = adminPage.waitForResponse(
      (res) => assignUrlMatch(res.url()),
      { timeout: 10_000 }
    );
    const partnerResponse = partnerPage.waitForResponse(
      (res) => assignUrlMatch(res.url()),
      { timeout: 10_000 }
    );

    await Promise.all([
      adminPage.getByRole('button', { name: /^claim this task$/i }).click(),
      partnerPage.getByRole('button', { name: /^claim this task$/i }).click(),
    ]);

    const settled = await Promise.allSettled([adminResponse, partnerResponse]);

    const responses: APIResponse[] = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled') {
        throw new Error(`Did not capture claim response: ${r.reason}`);
      }
      responses.push(r.value);
    }

    const statuses = responses.map((r) => r.status());
    const successes = statuses.filter((s) => s >= 200 && s < 300);
    const failures = statuses.filter((s) => s >= 400 && s < 500);

    expect(successes.length, `expected exactly one winner, got ${JSON.stringify(statuses)}`).toBe(1);
    expect(failures.length, `expected exactly one loser, got ${JSON.stringify(statuses)}`).toBe(1);

    const loserIndex = statuses.findIndex((s) => s >= 400 && s < 500);
    const loserPage = loserIndex === 0 ? adminPage : partnerPage;

    // The loser sees the inline error region rendered from
    // `actionError` (set in TasksPage's handleAssign catch via
    // extractApiError). The element is `role="alert"`.
    await expect(loserPage.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
