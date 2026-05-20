/**
 * B07 — Switching a household from split to joint mode preserves the
 * resolution status of pre-existing expenses, while new expenses created
 * post-switch are auto-resolved.
 *
 * Flow:
 *   1. Create couple in SPLIT mode.
 *   2. Seed an UNPAID expense via API (no `paidByUserId`) — `isResolved`
 *      defaults to false in split mode.
 *   3. PATCH /api/households/:id/settings with `{ financeMode: 'joint' }` as
 *      the admin.
 *   4. POST a second expense via API. In joint mode the service sets
 *      `isResolved: true` automatically.
 *   5. Assert via the LIST endpoint:
 *      - Old expense still has `isResolved: false`.
 *      - New expense has `isResolved: true`.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';

const API_BASE = 'http://localhost:5001';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('B07 — switching to joint auto-resolves new expenses; old expense stays unresolved', async ({ browser }) => {
  // ── 1. Couple in SPLIT mode ──
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    const api = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${couple.adminToken}` },
    });

    try {
      // ── 2. Seed an unpaid expense pre-switch ──
      const createOldRes = await api.post(
        `/api/households/${couple.household._id}/expenses`,
        {
          data: {
            description: 'B07 pre-switch rent',
            amount: 200,
            category: 'rent',
            date: new Date().toISOString().slice(0, 10),
            // paidByUserId omitted → unpaid → isResolved: false in split mode.
          },
        },
      );
      expect(createOldRes.ok()).toBeTruthy();
      const oldBody = (await createOldRes.json()) as {
        data?: { expense?: { _id?: string; isResolved?: boolean } };
        expense?: { _id?: string; isResolved?: boolean };
      };
      const oldExpense = oldBody.data?.expense ?? oldBody.expense;
      expect(oldExpense?._id).toBeTruthy();
      expect(oldExpense?.isResolved).toBe(false);
      const oldId = oldExpense!._id;

      // ── 3. Switch finance mode to joint ──
      const patchRes = await api.patch(
        `/api/households/${couple.household._id}/settings`,
        { data: { financeMode: 'joint' } },
      );
      expect(patchRes.ok()).toBeTruthy();

      // ── 4. Create a second expense post-switch ──
      const createNewRes = await api.post(
        `/api/households/${couple.household._id}/expenses`,
        {
          data: {
            description: 'B07 post-switch utilities',
            amount: 90,
            category: 'utilities',
            date: new Date().toISOString().slice(0, 10),
          },
        },
      );
      expect(createNewRes.ok()).toBeTruthy();
      const newBody = (await createNewRes.json()) as {
        data?: { expense?: { _id?: string; isResolved?: boolean } };
        expense?: { _id?: string; isResolved?: boolean };
      };
      const newExpense = newBody.data?.expense ?? newBody.expense;
      expect(newExpense?._id).toBeTruthy();
      expect(newExpense?.isResolved).toBe(true);
      const newId = newExpense!._id;

      // ── 5. Verify via LIST endpoint (covers all months) ──
      const listRes = await api.get(
        `/api/households/${couple.household._id}/expenses`,
        { params: { month: 'all', limit: '50' } },
      );
      expect(listRes.ok()).toBeTruthy();
      const listBody = (await listRes.json()) as {
        data?: { items?: Array<{ _id: string; isResolved: boolean }> };
        items?: Array<{ _id: string; isResolved: boolean }>;
      };
      const items = listBody.data?.items ?? listBody.items ?? [];
      const oldFromList = items.find((e) => e._id === oldId);
      const newFromList = items.find((e) => e._id === newId);
      expect(oldFromList?.isResolved).toBe(false);
      expect(newFromList?.isResolved).toBe(true);
    } finally {
      await api.dispose();
    }
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
