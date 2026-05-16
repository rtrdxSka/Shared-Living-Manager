/**
 * C03 — Split-mode settlement view shows the correct net balance.
 *
 * PIN: —
 *
 * Seeds three unresolved expenses (via API) such that:
 *   - admin paid 40 (equal split → admin owes 20, partner owes 20)
 *   - admin paid 30 (equal split → admin owes 15, partner owes 15)
 *   - partner paid 20 (equal split → admin owes 10, partner owes 10)
 *
 * Aggregate (equal split, 50/50):
 *   - admin's contribution = 70, fair share = (40 + 30 + 20) / 2 = 45
 *     → admin is over by 25 → partner owes admin 25.
 *   - partner's contribution = 20, fair share = 45 → partner is under by 25.
 *
 * The OverviewPage hero card in split-mode renders this as:
 *   - admin's context:   "{partnerNickname} owes you"   + "25.00 EUR"
 *   - partner's context: "You owe {adminNickname}"      + "25.00 EUR"
 *
 * The dashboard root URL `/dashboard` redirects to `/dashboard/overview`,
 * which is where the balance hero lives (OverviewPage.tsx lines ~398-412 —
 * the `balancePositive ? partnerOwesYou : youOwePartner` ternary).
 *
 * Note on currency rendering: MoneyAmount uses `toFixed(decimals)` +
 * `" ${currency}"` — so the EUR value reads as the literal string
 * "25.00 EUR" (no symbol). Confirmed in B05/B06.
 */
import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { createCoupleHousehold } from '../../support/household';
import { seedExpense } from '../../support/dataFactory';

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('C03 — split-mode settlement view shows partner-owes-admin €25 on equal split', async ({ browser }) => {
  const couple = await createCoupleHousehold({ browser, financeMode: 'split' });

  try {
    // ── 1. Resolve admin + partner userIds via /api/auth/me ─────────────
    // The expense `paidByUserId` field requires a Mongo `_id` — pull both
    // by hitting /auth/me as each user.
    const adminWhoami = await (async () => {
      const ctx = await browser.newContext();
      try {
        const res = await ctx.request.get('http://localhost:5001/api/auth/me', {
          headers: { Authorization: `Bearer ${couple.adminToken}` },
        });
        if (!res.ok()) throw new Error(`whoami(admin) failed: ${res.status()}`);
        const body = (await res.json()) as {
          data?: { user?: { _id?: string; id?: string } };
        };
        const u = body.data?.user;
        const id = u?._id ?? u?.id;
        if (!id) throw new Error(`admin whoami missing id: ${JSON.stringify(body)}`);
        return id;
      } finally {
        await ctx.close();
      }
    })();

    const partnerWhoami = await (async () => {
      const ctx = await browser.newContext();
      try {
        const res = await ctx.request.get('http://localhost:5001/api/auth/me', {
          headers: { Authorization: `Bearer ${couple.partnerToken}` },
        });
        if (!res.ok()) throw new Error(`whoami(partner) failed: ${res.status()}`);
        const body = (await res.json()) as {
          data?: { user?: { _id?: string; id?: string } };
        };
        const u = body.data?.user;
        const id = u?._id ?? u?.id;
        if (!id) throw new Error(`partner whoami missing id: ${JSON.stringify(body)}`);
        return id;
      } finally {
        await ctx.close();
      }
    })();

    // ── 2. Seed three expenses with explicit payers ─────────────────────
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 40,
      description: 'C03 admin paid 40',
      category: 'groceries',
      paidByUserId: adminWhoami,
    });
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 30,
      description: 'C03 admin paid 30',
      category: 'utilities',
      paidByUserId: adminWhoami,
    });
    await seedExpense({
      token: couple.adminToken,
      householdId: couple.household._id,
      amount: 20,
      description: 'C03 partner paid 20',
      category: 'rent',
      paidByUserId: partnerWhoami,
    });

    // ── 3. Admin /dashboard/overview: "Partner owes you" + 25.00 EUR ───
    const adminPage = await couple.adminContext.newPage();
    await adminPage.goto('/dashboard/overview');
    await adminPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });

    // The hero label uses an `<span>` to italicise the partner nickname,
    // so we anchor on the "owes you" suffix (and assert the partner name
    // appears nearby).
    await expect(adminPage.getByText(/owes you/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('25.00 EUR').first()).toBeVisible();
    await expect(adminPage.getByText(couple.partner.firstName).first()).toBeVisible();

    // ── 4. Partner /dashboard/overview: "You owe Admin" + 25.00 EUR ────
    const partnerPage = await couple.partnerContext.newPage();
    await partnerPage.goto('/dashboard/overview');
    await partnerPage.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });

    await expect(partnerPage.getByText(/you owe/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(partnerPage.getByText('25.00 EUR').first()).toBeVisible();
    await expect(partnerPage.getByText(couple.admin.firstName).first()).toBeVisible();
  } finally {
    await couple.adminContext.close();
    await couple.partnerContext.close();
  }
});
