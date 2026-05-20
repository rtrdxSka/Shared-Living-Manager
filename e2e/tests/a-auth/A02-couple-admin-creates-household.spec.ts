import { test, expect } from '@playwright/test';

import { TestApi } from '../../support/testApi';
import { uiRegister, uiVerifyEmail } from '../../support/auth';
import { TID } from '../../support/selectors';

// ── Per-test database reset ─────────────────────────────────────────────
// Each spec starts from a known-empty database. The /api/__test__/reset
// endpoint is only mounted when the backend boots with NODE_ENV=test, so
// the call is a no-op (404) in any non-e2e environment.

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

/**
 * A02 — Couple admin creates household with visible invite code.
 *
 * Drives the full happy-path for the admin side of a couple household:
 *   register UI → verify-email UI → (log out + log in UI) → onboarding (couple)
 *   → /dashboard → /dashboard/invite, where the generated invite code is shown.
 *
 * Notes on the real component shapes, captured here so future readers don't
 * repeat the grep:
 *
 *  • LIVING_ARRANGEMENT_OPTIONS labels the couple option
 *    "I live with a partner/spouse"; the option is rendered as a
 *    `<button role="radio">`.
 *
 *  • For couple, `getMemberCountConstraints` locks `totalMembers=2`, so
 *    StepHouseholdStructure renders exactly one partner row with sensible
 *    defaults (relationship=partner, ageGroup=adult, both participation
 *    switches on). The only required field we need to fill is the partner
 *    nickname; the relationship / ageGroup `<select>` fields are native
 *    HTML, not Radix combobox.
 *
 *  • StepFinancialPreferences renders finance-mode and split-method as
 *    `<button role="radio">` cards. Their accessible names are the option
 *    labels ("Joint pool", "Split between members", "Equal split"). Expense
 *    types are checkbox <label> wrappers — accessible via the
 *    `getByRole('checkbox', { name: 'Rent' })` pattern from A01.
 *
 *  • StepTaskPreferences uses the same role="radio" card pattern. The
 *    distribution-method block only appears when arrangement !== 'alone' AND
 *    taskManagementEnabled === 'full' (see shouldShowDistributionMethod).
 *
 *  • Post-submit, DashboardPage detects `uiMode === 'couple'` and renders the
 *    CoupleDashboard, *not* the solo placeholder. The invite code lives only
 *    on /dashboard/invite (grepped FrontEnd/src for `inviteCode`), so the
 *    spec navigates there explicitly.
 *
 *  • The invite code `<code>` element on InvitePage carries
 *    `data-testid="invite-code"` (added surgically as part of this task —
 *    the only accessible anchor would have been the randomly-generated UUID
 *    string itself, which we have no way to predict from the UI side).
 */
test('A02 — Couple admin creates household with visible invite code', async ({
  page,
  context,
}) => {
  const admin = {
    email: `admin-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Admin',
    // lastName must satisfy `isLength({ min: 2 })` in
    // `BackEnd/src/validators/auth.validator.ts`; a single letter would fail
    // server-side validation and the redirect-off-/register would never fire.
    lastName: 'Owner',
  };

  // ── 1. Register via the UI ──────────────────────────────────────────
  await uiRegister(page, admin);

  // ── 2. Verify the email via the UI ──────────────────────────────────
  await uiVerifyEmail(page, admin.email);

  // ── 3. Drop the auto-login session, then exercise /login ────────────
  // Mirrors A01: register auto-logged the user in, so we wipe cookies +
  // localStorage to surface the /login form.
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto('/login');
  await page.getByPlaceholder('ivan@example.com').fill(admin.email);
  await page.getByPlaceholder('••••••••').first().fill(admin.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/(get-started|dashboard|$)/, { timeout: 10_000 });
  if (!page.url().includes('/get-started')) {
    await page.goto('/get-started');
  }

  // ── 4. Pick "Create a household" from the choice screen ─────────────
  await page.getByRole('button', { name: /create a household/i }).click();

  // ── 5. Step 1: Living arrangement (couple) ──────────────────────────
  await page.getByLabel('Household name').fill('Two of Us');
  await page
    .getByRole('radio', { name: 'I live with a partner/spouse' })
    .click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 6. Step 2: Household structure (admin + 1 partner) ──────────────
  // Couple renders TWO "Nickname" labels (creator + member-0), so we cannot
  // use the bare `getByLabel('Nickname')` pattern from A01 — it would match
  // both inputs and fail strict mode. Target each by its known `id` instead
  // (both ids are grepped from StepHouseholdStructure.tsx).
  await page.locator('#creator-nickname').fill('AdminNick');

  // Partner row — for couple, the single member row is rendered with
  // defaults (relationship=partner, ageGroup=adult, finances+tasks switches
  // on). The partner nickname AND email are both required by
  // `memberStructureEntrySchema` in `FrontEnd/src/schemas/onboarding.schemas.ts`
  // (despite the task brief calling email "optional" — the schema enforces
  // a non-empty, RFC-valid address). Use a throwaway address.
  await page.locator('#member-0-nickname').fill('PartnerNick');
  await page
    .locator('#member-0-email')
    .fill(`partner-${Date.now()}@example.com`);

  await page.getByRole('button', { name: /continue/i }).click();

  // ── 7. Step 3: Financial preferences ────────────────────────────────
  // For couple, financeMode is required. Pick "Split between members" + the
  // "Equal split" sub-option, then mark Rent as a tracked expense type so
  // the validation passes (≥ 1 expense type required).
  await page.getByRole('radio', { name: 'Split between members' }).click();
  await page.getByRole('radio', { name: 'Equal split' }).click();
  await page.getByRole('checkbox', { name: 'Rent' }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 8. Step 4: Task preferences ─────────────────────────────────────
  // "Full management" enables the distribution-method block for couples.
  // Pick "Rotation" so the resulting household has a complete settings tree.
  // Each option card renders both the label and a description inside the
  // button; the accessible name therefore includes the description text, so
  // we match the leading label fragment with a regex (`^Rotation`) rather
  // than the full description sentence.
  await page.getByRole('radio', { name: /^Full management/ }).click();
  await page.getByRole('radio', { name: /^Rotation/ }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // ── 9. Step 5: Review + submit ──────────────────────────────────────
  await page.getByRole('button', { name: /create household/i }).click();

  // ── 10. Land on the couple dashboard ────────────────────────────────
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  // ── 11. Navigate to /dashboard/invite and assert the code is visible ──
  // Use in-app nav (the AppLayout exposes an "Invite" link at
  // `href="/dashboard/invite"`, see FrontEnd/src/components/layout/AppLayout.tsx).
  // A full `page.goto('/dashboard/invite')` remounts AuthProvider, which
  // re-triggers `/auth/refresh`; under repeated test runs that endpoint's
  // rate-limit (10/60s, see registerRateLimiter in auth.routes.ts) can return
  // 400 and bounce the user to /login. Client-side navigation keeps the
  // in-memory access token alive.
  await page.getByRole('link', { name: /^Invite$/ }).click();
  await page.waitForURL(/\/dashboard\/invite/, { timeout: 10_000 });
  const codeEl = page.getByTestId(TID.inviteCode);
  await expect(codeEl).toBeVisible({ timeout: 10_000 });
  // The backend generates the invite code via `crypto.randomUUID()`
  // (BackEnd/src/models/household.model.ts line 292). Asserting the visible
  // text matches a UUID v4 shape is the strongest check we can make without
  // round-tripping through the API.
  const text = (await codeEl.textContent())?.trim() ?? '';
  expect(text).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
});
