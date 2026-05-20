import { describe, it, expect } from 'vitest';
import { onboardingSurveySchema } from '../onboarding.schemas';

const baseSolo = {
  householdName: 'My Place',
  totalMembers: 1,
  livingArrangement: 'alone' as const,
  livingArrangementOther: '',
  creatorProfile: {
    nickname: 'Me',
    ageGroup: 'adult' as const,
    participatesInFinances: true,
    participatesInTasks: true,
  },
  memberStructure: [],
  trackedExpenseTypes: ['rent' as const],
  currency: 'EUR' as const,
  taskManagementEnabled: 'basic' as const,
};

const baseCouple = {
  ...baseSolo,
  householdName: 'A & B',
  totalMembers: 2,
  livingArrangement: 'couple' as const,
  memberStructure: [
    {
      nickname: 'Partner',
      ageGroup: 'adult' as const,
      relationship: 'partner' as const,
      participatesInFinances: true,
      participatesInTasks: true,
      email: 'partner@example.com',
    },
  ],
};

describe('onboardingSurveySchema (full final-submit)', () => {
  it('accepts a valid solo submission without financeMode', () => {
    const result = onboardingSurveySchema.safeParse(baseSolo);
    if (!result.success) console.error('solo failures:', result.error.issues);
    expect(result.success).toBe(true);
  });

  it('accepts a valid couple submission with financeMode "joint"', () => {
    const result = onboardingSurveySchema.safeParse({
      ...baseCouple,
      financeMode: 'joint',
    });
    if (!result.success) console.error('couple failures:', result.error.issues);
    expect(result.success).toBe(true);
  });

  it('rejects a couple submission missing financeMode', () => {
    const result = onboardingSurveySchema.safeParse(baseCouple);
    expect(result.success).toBe(false);
  });

  it('rejects a couple submission with full task management but no distribution method', () => {
    const result = onboardingSurveySchema.safeParse({
      ...baseCouple,
      financeMode: 'joint',
      taskManagementEnabled: 'full',
      // taskDistributionMethod intentionally omitted
    });
    expect(result.success).toBe(false);
  });
});
