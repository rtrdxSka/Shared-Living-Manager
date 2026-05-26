import type { HouseholdResponse } from '@/types/household.types';

const aliceMemberId = 'mem-alice-001';
const bobMemberId = 'mem-bob-001';

export const mockHousehold: HouseholdResponse = {
  _id: 'hh-couple-001',
  name: 'Alice & Bob',
  inviteCode: 'couple-invite-0001',
  totalMembers: 2,
  livingArrangement: 'couple',
  uiMode: 'couple',
  createdBy: 'user-alice-001',
  settlements: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  members: [
    {
      _id: aliceMemberId,
      userId: 'user-alice-001',
      nickname: 'Alice',
      role: 'owner',
      ageGroup: 'adult',
      relationship: 'partner',
      isCreator: true,
      participatesInFinances: true,
      participatesInTasks: true,
      monthlyIncome: 3000,
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: bobMemberId,
      userId: 'user-bob-001',
      nickname: 'Bob',
      role: 'member',
      ageGroup: 'adult',
      relationship: 'partner',
      isCreator: false,
      participatesInFinances: true,
      participatesInTasks: true,
      monthlyIncome: 2000,
      joinedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  settings: {
    currency: 'EUR',
    financeMode: 'split',
    expenseSplitMethod: 'equal',
    trackedExpenseTypes: ['rent', 'utilities', 'groceries'],
    taskManagementEnabled: 'full',
    taskDistributionMethod: 'rotation',
  },
} as unknown as HouseholdResponse;

// Variant: joint finance mode (used by ExpensesPage.test 'joint' variant)
export const mockHouseholdJoint: HouseholdResponse = {
  ...mockHousehold,
  settings: {
    ...mockHousehold.settings,
    financeMode: 'joint',
    expenseSplitMethod: undefined as never,
  },
};

// ── Finance-mode × split-method variants ──────────────────────────────

export const mockHouseholdSplitEqual: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, financeMode: 'split', expenseSplitMethod: 'equal' },
};

export const mockHouseholdSplitIncomeBased: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, financeMode: 'split', expenseSplitMethod: 'income_based' },
};

export const mockHouseholdSplitUsageBased: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, financeMode: 'split', expenseSplitMethod: 'usage_based' },
};

// Custom split — the stored percentage is the OWNER's (Alice's) share.
export const mockHouseholdSplitCustom: HouseholdResponse = {
  ...mockHousehold,
  settings: {
    ...mockHousehold.settings,
    financeMode: 'split',
    expenseSplitMethod: 'custom',
    customSplitPercentage: 70,
  },
} as unknown as HouseholdResponse;

// ── Task-management × distribution-method variants ────────────────────

export const mockHouseholdTaskFixed: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, taskManagementEnabled: 'full', taskDistributionMethod: 'fixed' },
};

export const mockHouseholdTaskRotation: HouseholdResponse = {
  ...mockHousehold,
  settings: {
    ...mockHousehold.settings,
    taskManagementEnabled: 'full',
    taskDistributionMethod: 'rotation',
    taskRotationConfig: {
      orderedMemberIds: ['mem-alice-001', 'mem-bob-001'],
      startedAt: '2026-05-01T00:00:00.000Z',
      periodDays: 7,
    },
  },
} as unknown as HouseholdResponse;

export const mockHouseholdTaskVoluntary: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, taskManagementEnabled: 'full', taskDistributionMethod: 'voluntary' },
};

export const mockHouseholdTaskBasic: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, taskManagementEnabled: 'basic' },
};

export const mockHouseholdTaskDisabled: HouseholdResponse = {
  ...mockHousehold,
  settings: { ...mockHousehold.settings, taskManagementEnabled: 'disabled' },
};

// ── Roommate variants (uiMode === 'roommates') ──────────────────────────────
//
// 3-member households used by RoommatesStatsRow, AppLayout nav, ExpensesPage,
// and AccountPage tests. Members are Alice, Bob, Carol — same Alice/Bob ids
// as the couple fixture so tests can reuse `mockUsers.alice/.bob`, plus a new
// Carol member.

const carolMemberId = 'mem-carol-001';

const baseRoommatesHousehold: HouseholdResponse = {
  ...mockHousehold,
  _id: 'hh-roommates-001',
  name: 'Apartment 3B',
  totalMembers: 3,
  livingArrangement: 'roommates',
  uiMode: 'roommates',
  members: [
    ...mockHousehold.members,
    {
      _id: carolMemberId,
      userId: 'user-carol-001',
      nickname: 'Carol',
      role: 'member',
      ageGroup: 'adult',
      relationship: 'roommate',
      isCreator: false,
      participatesInFinances: true,
      participatesInTasks: true,
      monthlyIncome: 2500,
      joinedAt: '2026-01-03T00:00:00.000Z',
    },
  ],
} as unknown as HouseholdResponse;

export const mockHouseholdRoommatesJoint: HouseholdResponse = {
  ...baseRoommatesHousehold,
  settings: {
    ...baseRoommatesHousehold.settings,
    financeMode: 'joint',
    expenseSplitMethod: undefined as never,
  },
};

export const mockHouseholdRoommatesSplit: HouseholdResponse = {
  ...baseRoommatesHousehold,
  settings: {
    ...baseRoommatesHousehold.settings,
    financeMode: 'split',
    expenseSplitMethod: 'equal',
  },
};

// Roommates + custom split with stored per-member shares (Alice 50 / Bob 30 / Carol 20).
export const mockHouseholdRoommatesSplitCustom: HouseholdResponse = {
  ...baseRoommatesHousehold,
  settings: {
    ...baseRoommatesHousehold.settings,
    financeMode: 'split',
    expenseSplitMethod: 'custom',
    customSplitShares: [
      { userId: 'user-alice-001', pct: 50 },
      { userId: 'user-bob-001', pct: 30 },
      { userId: 'user-carol-001', pct: 20 },
    ],
  },
} as unknown as HouseholdResponse;
