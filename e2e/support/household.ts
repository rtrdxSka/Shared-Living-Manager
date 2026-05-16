import { request as playwrightRequest, type Browser, type BrowserContext } from '@playwright/test';

import { registerAndVerify, loginAs, type TestUser } from './auth';

// Backend root (NOT including `/api`). Playwright's `request.newContext`
// strips the path segment of `baseURL` whenever the request URL starts with
// `/`, so we keep baseURL as origin-only and prefix the API version per
// request.
const API_BASE = 'http://localhost:5001';

type FinanceMode = 'joint' | 'split';
type TaskMethod = 'rotation' | 'fixed' | 'voluntary';

export interface CoupleHandle {
  admin: TestUser;
  partner: TestUser;
  household: { _id: string; inviteCode: string };
  adminToken: string;
  partnerToken: string;
  adminContext: BrowserContext;
  partnerContext: BrowserContext;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * POST /api/auth/login → returns the accessToken from
 * `{ data: { tokens: { accessToken } } }` (shape confirmed in
 * auth.controller.ts).
 */
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
 * Builds an `ICreateHouseholdInput` for a couple arrangement (admin + 1
 * partner). The shape matches `createHouseholdValidation` in
 * `BackEnd/src/validators/household.validator.ts` — it is the full
 * onboarding-survey payload, NOT a minimal `{ name, settings }` object.
 */
function buildCoupleHouseholdPayload(opts: {
  admin: TestUser;
  partner: TestUser;
  financeMode: FinanceMode;
  taskMethod: TaskMethod;
}): Record<string, unknown> {
  return {
    householdName: 'E2E Household',
    totalMembers: 2,
    livingArrangement: 'couple',
    creatorProfile: {
      nickname: opts.admin.firstName,
      ageGroup: 'adult',
      participatesInFinances: true,
      participatesInTasks: true,
    },
    memberStructure: [
      {
        nickname: opts.partner.firstName,
        relationship: 'partner',
        ageGroup: 'adult',
        participatesInFinances: true,
        participatesInTasks: true,
        email: opts.partner.email,
      },
    ],
    financeMode: opts.financeMode,
    // expenseSplitMethod only required when financeMode === 'split'; include
    // it unconditionally so toggling the mode doesn't change the payload
    // shape.
    expenseSplitMethod: 'equal',
    trackedExpenseTypes: ['rent', 'utilities', 'groceries'],
    currency: 'EUR',
    taskManagementEnabled: 'full',
    taskDistributionMethod: opts.taskMethod,
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
      throw new Error(`createHousehold response missing _id/inviteCode: ${JSON.stringify(body)}`);
    }
    return { _id: household._id, inviteCode: household.inviteCode };
  } finally {
    await api.dispose();
  }
}

/**
 * POST /api/households/join — body `{ inviteCode }`. The validator enforces
 * `isUUID()` on the invite code, which the household model generates by
 * default.
 */
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

export interface HouseholdMemberSummary {
  _id: string;
  userId?: string;
  nickname: string;
  role: string;
  isCreator: boolean;
  participatesInTasks: boolean;
}

/**
 * GET /api/households/:id — returns the full household payload. The Group D
 * task tests need each member's subdocument `_id` (NOT the user id) to pass
 * to `assignedToMemberId` etc., so this helper exposes a minimal
 * `members[]` slice.
 */
export async function fetchHouseholdMembers(
  token: string,
  householdId: string,
): Promise<HouseholdMemberSummary[]> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const res = await api.get(`/api/households/${householdId}`);
    if (!res.ok()) {
      throw new Error(`fetchHouseholdMembers failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { household?: { members?: HouseholdMemberSummary[] } };
    };
    const members = body.data?.household?.members;
    if (!members) {
      throw new Error(`fetchHouseholdMembers: missing members in ${JSON.stringify(body)}`);
    }
    return members;
  } finally {
    await api.dispose();
  }
}

/**
 * End-to-end factory for couple-mode tests:
 *   1. Register + verify both users via API.
 *   2. Create the household as the admin (defaults to the onboarding payload
 *      shape for a `couple` arrangement).
 *   3. Have the partner accept via invite code.
 *   4. Open two parallel BrowserContexts, drive the /login form in each, and
 *      return both — so callers can act on the household concurrently from
 *      either side without sharing cookies.
 *
 * Both API access tokens are returned alongside the contexts so callers can
 * seed expenses/tasks via API (faster than UI) for the half of a flow where
 * the UI itself isn't under test.
 */
export async function createCoupleHousehold(opts: {
  browser: Browser;
  financeMode: FinanceMode;
  taskMethod?: TaskMethod;
}): Promise<CoupleHandle> {
  const admin: TestUser = {
    email: uniqueEmail('admin'),
    password: 'Password123!',
    firstName: 'Admin',
    lastName: 'Owner',
  };
  const partner: TestUser = {
    email: uniqueEmail('partner'),
    password: 'Password123!',
    firstName: 'Partner',
    lastName: 'Member',
  };

  await registerAndVerify(admin);
  await registerAndVerify(partner);

  const adminToken = await loginAndGetToken(admin.email, admin.password);
  const payload = buildCoupleHouseholdPayload({
    admin,
    partner,
    financeMode: opts.financeMode,
    taskMethod: opts.taskMethod ?? 'rotation',
  });
  const household = await apiCreateHousehold(adminToken, payload);

  const partnerToken = await loginAndGetToken(partner.email, partner.password);
  await apiJoinHousehold(partnerToken, household.inviteCode);

  const adminContext = await opts.browser.newContext();
  const partnerContext = await opts.browser.newContext();
  await loginAs(adminContext, admin.email, admin.password);
  await loginAs(partnerContext, partner.email, partner.password);

  return {
    admin,
    partner,
    household,
    adminToken,
    partnerToken,
    adminContext,
    partnerContext,
  };
}
