/**
 * G01 — Roommates house-rules happy path: three roommates onboard, Alice
 * files an issue, Bob escalates it with a proposed rule, all three roommates
 * cast yes ballots, Alice (the owner / household creator) closes the vote
 * early, and the rule appears in the Passed Rules tab.
 *
 * Why this lives at the top of /tests (no group prefix): the task brief from
 * the implementation plan explicitly names the file `roommates-house-rules.spec.ts`
 * directly under `e2e/tests/`. The other test groups (a-f) cover couple-mode
 * flows; the roommates UI is gated behind a 3+ member household so it needs
 * its own seeding path rather than reusing `createCoupleHousehold`.
 *
 * Setup strategy (mirrors `support/household.ts → createCoupleHousehold`):
 *   1. Register + verify three users via API (`registerAndVerify`).
 *   2. Alice creates a 3-member roommates household via the create endpoint;
 *      the onboarding payload mirrors the couple shape but uses
 *      `livingArrangement: 'roommates'` and `totalMembers: 3`. Alice is the
 *      household creator and therefore inherits the `owner` role — required
 *      by `vote.service.ts → closeVote` ("Admin or owner required").
 *   3. Bob and Carol join via the invite code (POST /households/join).
 *   4. Three Playwright `BrowserContext`s drive the /login form so each user
 *      has their own cookies and React Query cache.
 *
 * UI selectors are derived from the actual implementation:
 *   - `IssuesTab`: "New issue" button, NewIssueSheet inputs (`#issue-title`,
 *     `#issue-body`), "Post anonymously" submit.
 *   - `IssueDetailDialog`: clicking an issue card opens it; "Escalate to vote"
 *     button.
 *   - `EscalateIssueDialog` → `VoteProposalForm`: prefilled
 *     `#proposed-rule-title` / `#proposed-rule-text`, `#deadline-days`, submit
 *     labelled "Open vote".
 *   - `VotesTab.OpenVoteCard`: "yes" button per ballot row, "Close now" admin
 *     CTA.
 *   - `RulesTab`: rule cards render the title and "Passed <date>" line.
 *
 * Test isolation: every spec in this suite resets the database in
 * `beforeEach` via the test-only `/api/__test__/reset` endpoint (see
 * `support/testApi.ts`).
 */
import { test, expect, request as playwrightRequest, type Browser } from '@playwright/test';

import { TestApi } from '../support/testApi';
import { registerAndVerify, loginAs, type TestUser } from '../support/auth';

// Backend origin (no /api). Same convention as other support helpers.
const API_BASE = 'http://localhost:5001';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function loginAndGetToken(email: string, password: string): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE });
  try {
    const res = await api.post('/api/auth/login', { data: { email, password } });
    if (!res.ok()) {
      throw new Error(`login failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { tokens?: { accessToken?: string }; accessToken?: string };
      accessToken?: string;
    };
    const token =
      body.data?.tokens?.accessToken ??
      body.data?.accessToken ??
      body.accessToken;
    if (!token) throw new Error('login returned no accessToken');
    return token;
  } finally {
    await api.dispose();
  }
}

/**
 * Build the onboarding payload for a 3-roommate household. Shape matches
 * `createHouseholdValidation` — the validator enforces
 * `memberStructure.length === totalMembers - 1` and `livingArrangement ===
 * 'roommates'` requires at least 2 members. `relationship: 'roommate'` is one
 * of the allowed RELATIONSHIPS in `household.types.ts`.
 */
function buildRoommatesPayload(opts: {
  alice: TestUser;
  bob: TestUser;
  carol: TestUser;
}): Record<string, unknown> {
  return {
    householdName: 'E2E Roommates House',
    totalMembers: 3,
    livingArrangement: 'roommates',
    creatorProfile: {
      nickname: opts.alice.firstName,
      ageGroup: 'adult',
      participatesInFinances: true,
      participatesInTasks: true,
    },
    memberStructure: [
      {
        nickname: opts.bob.firstName,
        relationship: 'roommate',
        ageGroup: 'adult',
        participatesInFinances: true,
        participatesInTasks: true,
        email: opts.bob.email,
      },
      {
        nickname: opts.carol.firstName,
        relationship: 'roommate',
        ageGroup: 'adult',
        participatesInFinances: true,
        participatesInTasks: true,
        email: opts.carol.email,
      },
    ],
    financeMode: 'split',
    expenseSplitMethod: 'equal',
    trackedExpenseTypes: ['rent', 'utilities', 'groceries'],
    currency: 'EUR',
    taskManagementEnabled: 'full',
    taskDistributionMethod: 'rotation',
  };
}

async function apiCreateHousehold(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ _id: string; inviteCode: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const res = await api.post('/api/households', { data: payload });
    if (!res.ok()) {
      throw new Error(`createHousehold failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { household?: { _id?: string; inviteCode?: string } };
      household?: { _id?: string; inviteCode?: string };
    };
    const household = body.data?.household ?? body.household;
    if (!household?._id || !household?.inviteCode) {
      throw new Error(
        `createHousehold response missing _id/inviteCode: ${JSON.stringify(body)}`,
      );
    }
    return { _id: household._id, inviteCode: household.inviteCode };
  } finally {
    await api.dispose();
  }
}

async function apiJoinHousehold(token: string, inviteCode: string): Promise<void> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const res = await api.post('/api/households/join', { data: { inviteCode } });
    if (!res.ok()) {
      throw new Error(`joinHousehold failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await api.dispose();
  }
}

interface RoommatesHandle {
  alice: TestUser;
  bob: TestUser;
  carol: TestUser;
  household: { _id: string; inviteCode: string };
  aliceContext: Awaited<ReturnType<Browser['newContext']>>;
  bobContext: Awaited<ReturnType<Browser['newContext']>>;
  carolContext: Awaited<ReturnType<Browser['newContext']>>;
}

/**
 * End-to-end factory for a 3-roommate household. Alice is the creator and
 * therefore the `owner`; Bob and Carol are regular members (`member` role).
 */
async function createRoommatesHousehold(browser: Browser): Promise<RoommatesHandle> {
  const alice: TestUser = {
    email: uniqueEmail('alice'),
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Owner',
  };
  const bob: TestUser = {
    email: uniqueEmail('bob'),
    password: 'Password123!',
    firstName: 'Bob',
    lastName: 'Member',
  };
  const carol: TestUser = {
    email: uniqueEmail('carol'),
    password: 'Password123!',
    firstName: 'Carol',
    lastName: 'Member',
  };

  await registerAndVerify(alice);
  await registerAndVerify(bob);
  await registerAndVerify(carol);

  const aliceToken = await loginAndGetToken(alice.email, alice.password);
  const household = await apiCreateHousehold(
    aliceToken,
    buildRoommatesPayload({ alice, bob, carol }),
  );

  const bobToken = await loginAndGetToken(bob.email, bob.password);
  await apiJoinHousehold(bobToken, household.inviteCode);

  const carolToken = await loginAndGetToken(carol.email, carol.password);
  await apiJoinHousehold(carolToken, household.inviteCode);

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const carolContext = await browser.newContext();
  await loginAs(aliceContext, alice.email, alice.password);
  await loginAs(bobContext, bob.email, bob.password);
  await loginAs(carolContext, carol.email, carol.password);

  return {
    alice,
    bob,
    carol,
    household,
    aliceContext,
    bobContext,
    carolContext,
  };
}

test.beforeEach(async () => {
  const api = await TestApi.create();
  try {
    await api.resetDatabase();
  } finally {
    await api.dispose();
  }
});

test('G01 — roommates: file issue → escalate → vote passes → rule appears', async ({
  browser,
}) => {
  // Six navigations across three browser contexts plus three API
  // register/verify round-trips push past the 30s default. Mark slow to get
  // the 3x multiplier (90s).
  test.slow();
  const house = await createRoommatesHousehold(browser);

  const ISSUE_TITLE = 'Dishes pile up!';
  const ISSUE_BODY = 'Please clean dishes within 24 hours of using them.';
  const RULE_TITLE = 'Dishes within 24h';
  const RULE_TEXT = 'Each person cleans their dishes within 24h of use.';

  try {
    // ─── 1. Alice files an issue ─────────────────────────────────────
    const alice = await house.aliceContext.newPage();
    await alice.goto('/dashboard/house-rules');
    await alice.waitForURL(/\/dashboard\/house-rules/, { timeout: 10_000 });

    // The Issues tab is the default. Click "New issue" to open the
    // NewIssueSheet (a Radix Sheet on the right).
    await alice.getByRole('button', { name: /^new issue$/i }).click();
    await expect(alice.getByText(/raise an issue/i)).toBeVisible({ timeout: 5_000 });
    await alice.locator('#issue-title').fill(ISSUE_TITLE);
    await alice.locator('#issue-body').fill(ISSUE_BODY);
    await alice.getByRole('button', { name: /post anonymously/i }).click();

    // Issue appears in the list (Issues tab defaults to status=open).
    await expect(alice.getByText(ISSUE_TITLE).first()).toBeVisible({ timeout: 10_000 });

    // ─── 2. Bob escalates the issue with a proposed rule ─────────────
    const bob = await house.bobContext.newPage();
    await bob.goto('/dashboard/house-rules');
    await bob.waitForURL(/\/dashboard\/house-rules/, { timeout: 10_000 });

    // Click the issue card to open IssueDetailDialog. The card uses
    // role="button" so getByRole works; .first() guards against duplicate
    // matches if the title text appears elsewhere.
    await bob.getByRole('button', { name: new RegExp(ISSUE_TITLE) }).first().click();
    await expect(bob.getByRole('button', { name: /escalate to vote/i })).toBeVisible({
      timeout: 5_000,
    });
    await bob.getByRole('button', { name: /escalate to vote/i }).click();

    // EscalateIssueDialog → VoteProposalForm. Wait for the form's
    // distinctive title input to appear (the dialog stacks on top of the
    // IssueDetailDialog with z-[60]).
    await expect(bob.locator('#proposed-rule-title')).toBeVisible({ timeout: 5_000 });
    await bob.locator('#proposed-rule-title').fill(RULE_TITLE);
    await bob.locator('#proposed-rule-text').fill(RULE_TEXT);
    // Default deadline is 7 days; explicitly set 1 so the vote stays well
    // inside the validator's 1–30 day window.
    await bob.locator('#deadline-days').fill('1');
    await bob.getByRole('button', { name: /open vote/i }).click();

    // After successful escalation the EscalateIssueDialog closes; if the
    // IssueDetailDialog is still open it can intercept tab clicks.
    // `bob.goto(...)` is the simplest way to guarantee a clean DOM.
    await bob.goto('/dashboard/house-rules');
    await bob.waitForURL(/\/dashboard\/house-rules/, { timeout: 10_000 });
    await bob.getByRole('tab', { name: /active votes/i }).click();
    await expect(bob.getByRole('heading', { name: RULE_TITLE })).toBeVisible({
      timeout: 10_000,
    });

    // ─── 3. All three roommates cast yes ─────────────────────────────
    // OpenVoteCard renders three ballot buttons labelled yes/no/abstain.
    // We scope to the Card whose heading text is RULE_TITLE to be precise.
    const carol = await house.carolContext.newPage();
    for (const [label, page] of [
      ['Alice', alice],
      ['Bob', bob],
      ['Carol', carol],
    ] as const) {
      // Navigate fresh so the Active Votes tab reflects the latest tally.
      // eslint-disable-next-line no-await-in-loop
      await page.goto('/dashboard/house-rules');
      // eslint-disable-next-line no-await-in-loop
      await page.waitForURL(/\/dashboard\/house-rules/, { timeout: 10_000 });
      // eslint-disable-next-line no-await-in-loop
      await page.getByRole('tab', { name: /active votes/i }).click();
      // eslint-disable-next-line no-await-in-loop
      await expect(
        page.getByRole('heading', { name: RULE_TITLE }),
      ).toBeVisible({ timeout: 10_000 });

      // Find the OpenVoteCard for this rule via its heading; the card is
      // the closest ancestor that also contains a yes/no/abstain button row.
      const cardRoot = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: RULE_TITLE }) })
        .filter({ has: page.getByRole('button', { name: /^yes$/i }) })
        .last();
      // eslint-disable-next-line no-await-in-loop
      await cardRoot.getByRole('button', { name: /^yes$/i }).click();
      // Confirm the click took: aria-pressed flips to true on the active
      // ballot button after the mutation settles.
      // eslint-disable-next-line no-await-in-loop
      await expect(cardRoot.getByRole('button', { name: /^yes$/i })).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 5_000 },
      );
      // eslint-disable-next-line no-console
      console.log(`[G01] ${label} cast yes`);
    }

    // ─── 4. Alice (owner) closes the vote early ───────────────────────
    // The "Close now" button only renders for owner/admin (see VotesTab.tsx).
    // Alice is the household creator and therefore the owner.
    await alice.goto('/dashboard/house-rules');
    await alice.waitForURL(/\/dashboard\/house-rules/, { timeout: 10_000 });
    await alice.getByRole('tab', { name: /active votes/i }).click();
    await expect(alice.getByRole('heading', { name: RULE_TITLE })).toBeVisible({
      timeout: 10_000,
    });
    await alice.getByRole('button', { name: /close now/i }).click();

    // ─── 5. The rule appears in Passed Rules ──────────────────────────
    // House-rule auto-creation: vote.service.ts → closeVote calls
    // houseRuleService.createFromVote when the tally meets the threshold,
    // so the RulesTab should list the new rule. With 3/3 yes ballots the
    // tally trivially meets simple_majority / supermajority / unanimous.
    await alice.getByRole('tab', { name: /passed rules/i }).click();
    await expect(alice.getByRole('heading', { name: RULE_TITLE })).toBeVisible({
      timeout: 10_000,
    });
    await expect(alice.getByText(/^Passed /).first()).toBeVisible({ timeout: 5_000 });
  } finally {
    await house.aliceContext.close();
    await house.bobContext.close();
    await house.carolContext.close();
  }
});
