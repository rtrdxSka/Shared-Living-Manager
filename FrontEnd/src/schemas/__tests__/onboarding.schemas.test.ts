import { describe, it, expect } from 'vitest';
import {
  stepLivingArrangementSchema,
  creatorProfileSchema,
  createStepHouseholdStructureSchema,
  createStepFinancialPreferencesSchema,
  createStepTaskPreferencesSchema,
} from '../onboarding.schemas';

describe('stepLivingArrangementSchema', () => {
  it('accepts a valid couple household', () => {
    expect(
      stepLivingArrangementSchema.safeParse({
        householdName: 'A & B',
        totalMembers: 2,
        livingArrangement: 'couple',
        livingArrangementOther: '',
      }).success,
    ).toBe(true);
  });

  it('rejects householdName under 2 characters', () => {
    expect(
      stepLivingArrangementSchema.safeParse({
        householdName: 'A',
        totalMembers: 2,
        livingArrangement: 'couple',
        livingArrangementOther: '',
      }).success,
    ).toBe(false);
  });

  it('requires livingArrangementOther text when arrangement is "other"', () => {
    expect(
      stepLivingArrangementSchema.safeParse({
        householdName: 'XY',
        totalMembers: 2,
        livingArrangement: 'other',
        livingArrangementOther: '',
      }).success,
    ).toBe(false);

    expect(
      stepLivingArrangementSchema.safeParse({
        householdName: 'XY',
        totalMembers: 2,
        livingArrangement: 'other',
        livingArrangementOther: 'co-op',
      }).success,
    ).toBe(true);
  });

  it('rejects mismatched totalMembers for couple (must be exactly 2)', () => {
    expect(
      stepLivingArrangementSchema.safeParse({
        householdName: 'XY',
        totalMembers: 3,
        livingArrangement: 'couple',
        livingArrangementOther: '',
      }).success,
    ).toBe(false);
  });
});

describe('creatorProfileSchema', () => {
  it('accepts a valid creator profile', () => {
    expect(
      creatorProfileSchema.safeParse({
        nickname: 'Me',
        ageGroup: 'adult',
        participatesInFinances: true,
        participatesInTasks: true,
      }).success,
    ).toBe(true);
  });
  it('rejects empty nickname', () => {
    expect(
      creatorProfileSchema.safeParse({
        nickname: '',
        ageGroup: 'adult',
        participatesInFinances: true,
        participatesInTasks: true,
      }).success,
    ).toBe(false);
  });
});

describe('createStepHouseholdStructureSchema (couple, 2 members)', () => {
  const schema = createStepHouseholdStructureSchema('couple', 2);

  it('accepts exactly 1 partner entry', () => {
    expect(
      schema.safeParse({
        creatorProfile: {
          nickname: 'Me',
          ageGroup: 'adult',
          participatesInFinances: true,
          participatesInTasks: true,
        },
        memberStructure: [
          {
            nickname: 'Partner',
            ageGroup: 'adult',
            relationship: 'partner',
            participatesInFinances: true,
            participatesInTasks: true,
            email: 'p@x.co',
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects wrong member count (zero instead of 1)', () => {
    expect(
      schema.safeParse({
        creatorProfile: {
          nickname: 'Me',
          ageGroup: 'adult',
          participatesInFinances: true,
          participatesInTasks: true,
        },
        memberStructure: [],
      }).success,
    ).toBe(false);
  });
});

describe('createStepFinancialPreferencesSchema', () => {
  it('alone arrangement: financeMode optional', () => {
    const schema = createStepFinancialPreferencesSchema('alone');
    expect(
      schema.safeParse({ currency: 'EUR', trackedExpenseTypes: ['rent'] }).success,
    ).toBe(true);
  });

  it('couple arrangement: financeMode required', () => {
    const schema = createStepFinancialPreferencesSchema('couple');
    expect(
      schema.safeParse({ currency: 'EUR', trackedExpenseTypes: ['rent'] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        currency: 'EUR',
        trackedExpenseTypes: ['rent'],
        financeMode: 'joint',
      }).success,
    ).toBe(true);
  });

  it('couple + split mode: expenseSplitMethod required', () => {
    const schema = createStepFinancialPreferencesSchema('couple');
    expect(
      schema.safeParse({
        currency: 'EUR',
        trackedExpenseTypes: ['rent'],
        financeMode: 'split',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        currency: 'EUR',
        trackedExpenseTypes: ['rent'],
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      }).success,
    ).toBe(true);
  });
});

describe('createStepTaskPreferencesSchema', () => {
  it('alone arrangement: distribution method not required', () => {
    const schema = createStepTaskPreferencesSchema('alone');
    expect(schema.safeParse({ taskManagementEnabled: 'full' }).success).toBe(true);
  });

  it('couple + full management: distribution method required', () => {
    const schema = createStepTaskPreferencesSchema('couple');
    expect(schema.safeParse({ taskManagementEnabled: 'full' }).success).toBe(false);
    expect(
      schema.safeParse({
        taskManagementEnabled: 'full',
        taskDistributionMethod: 'rotation',
      }).success,
    ).toBe(true);
  });

  it('couple + basic management: distribution method NOT required', () => {
    const schema = createStepTaskPreferencesSchema('couple');
    expect(schema.safeParse({ taskManagementEnabled: 'basic' }).success).toBe(true);
  });
});
