/**
 * B03 — POST .../expenses/:expenseId/claim returns 400 in joint mode.
 *
 * PIN: commit `ab446cb` — `expense.service.ts` line ~248-251 throws
 * `BadRequestError('Joint accounts do not use the claim/resolve flow')`
 * whenever a claim is attempted on a joint-mode household. This spec exercises
 * the API contract directly (not via the UI) so that a future refactor that
 * removes the UI's `canClaim` gate would still be caught here.
 *
 * Setup: create a joint-mode household, seed an UNPAID expense via API
 * (omitting `paidByUserId` — joint mode still auto-resolves but the claim
 * endpoint runs the financeMode check BEFORE checking `isResolved`, so the
 * test would still get 400 either way).
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

test('B03 — API rejects claim on joint-mode expense with 400', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'joint' });

  try {
    // ── 1. Seed an expense via API (faster + deterministic) ──
    const api = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${couple.adminToken}` },
    });
    let expenseId: string;
    try {
      const createRes = await api.post(
        `/api/households/${couple.household._id}/expenses`,
        {
          data: {
            description: 'B03 joint utilities',
            amount: 80,
            category: 'utilities',
            date: new Date().toISOString().slice(0, 10),
          },
        },
      );
      expect(createRes.ok()).toBeTruthy();
      const body = (await createRes.json()) as {
        data?: { expense?: { _id?: string } };
        expense?: { _id?: string };
      };
      const id = body.data?.expense?._id ?? body.expense?._id;
      expect(id).toBeTruthy();
      expenseId = id as string;

      // ── 2. Try to claim — must return 400 ──
      const claimRes = await api.post(
        `/api/households/${couple.household._id}/expenses/${expenseId}/claim`,
      );
      expect(claimRes.status()).toBe(400);

      // Error message contains the joint-mode rejection copy.
      const errBody = (await claimRes.json()) as { message?: string; error?: string };
      const msg = errBody.message ?? errBody.error ?? '';
      expect(msg).toMatch(/joint/i);
    } finally {
      await api.dispose();
    }
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
