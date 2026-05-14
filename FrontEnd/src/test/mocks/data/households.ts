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
