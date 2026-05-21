import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { expenseService } from '../../../src/services/expense.service';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';

// Counter used to generate unique emails / invite codes per beforeEach run
// (the setup seed runs once per file in beforeAll — these test rows must not
// collide with each other across the 7 cases in this describe block).
let counter = 0;

describe('expenseService — subgroup validation', () => {
  let householdId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alice: any, bob: any, carol: any;

  beforeEach(async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;
    alice = await new User({
      email: `subgroup-alice-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    bob = await new User({
      email: `subgroup-bob-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    carol = await new User({
      email: `subgroup-carol-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Carol',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();

    const h = await new Household({
      name: 'Subgroup Test House',
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: alice._id,
      inviteCode: `subgroup-invite-${suffix}`,
      members: [
        {
          userId: alice._id,
          nickname: 'Alice',
          ageGroup: 'adult',
          role: 'owner',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: true,
        },
        {
          userId: bob._id,
          nickname: 'Bob',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: carol._id,
          nickname: 'Carol',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
      ],
      settings: {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
        currency: 'BGN',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: [],
      },
    }).save();
    householdId = h._id.toString();
  });

  it('accepts a subgroup that is a subset of finance-participating members', async () => {
    const expense = await expenseService.addExpense(householdId, alice._id.toString(), {
      description: 'Beer',
      amount: 24,
      category: 'groceries',
      date: new Date().toISOString(),
      paidByUserId: alice._id.toString(),
      participantUserIds: [alice._id.toString(), bob._id.toString()],
    });
    expect(expense.participantUserIds).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString()])
    );
  });

  it('rejects when payer is not in the participant subgroup', async () => {
    await expect(
      expenseService.addExpense(householdId, alice._id.toString(), {
        description: 'Beer',
        amount: 24,
        category: 'groceries',
        date: new Date().toISOString(),
        paidByUserId: carol._id.toString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
      })
    ).rejects.toThrow(/payer.*not.*in.*participants/i);
  });

  it('rejects when a participantUserId is not a household member', async () => {
    const stranger = new Types.ObjectId().toString();
    await expect(
      expenseService.addExpense(householdId, alice._id.toString(), {
        description: 'Beer',
        amount: 24,
        category: 'groceries',
        date: new Date().toISOString(),
        participantUserIds: [alice._id.toString(), stranger],
      })
    ).rejects.toThrow(/not.*finance|not.*member/i);
  });

  it('accepts customSplitOverrides summing to 100', async () => {
    const expense = await expenseService.addExpense(householdId, alice._id.toString(), {
      description: 'Trip',
      amount: 100,
      category: 'other',
      date: new Date().toISOString(),
      paidByUserId: alice._id.toString(),
      participantUserIds: [alice._id.toString(), bob._id.toString(), carol._id.toString()],
      customSplitOverrides: [
        { userId: alice._id.toString(), pct: 50 },
        { userId: bob._id.toString(), pct: 30 },
        { userId: carol._id.toString(), pct: 20 },
      ],
    });
    expect(expense.customSplitOverrides).toHaveLength(3);
  });

  it('rejects customSplitOverrides not summing to 100', async () => {
    await expect(
      expenseService.addExpense(householdId, alice._id.toString(), {
        description: 'Trip',
        amount: 100,
        category: 'other',
        date: new Date().toISOString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 60 },
          { userId: bob._id.toString(), pct: 30 },
        ],
      })
    ).rejects.toThrow(/sum.*100/i);
  });

  it('rejects customSplitOverrides without participantUserIds', async () => {
    await expect(
      expenseService.addExpense(householdId, alice._id.toString(), {
        description: 'X',
        amount: 10,
        category: 'other',
        date: new Date().toISOString(),
        customSplitOverrides: [{ userId: alice._id.toString(), pct: 100 }],
      })
    ).rejects.toThrow(/customSplitOverrides.*requires.*participantUserIds/i);
  });

  it('rejects customSplitOverrides whose userIds do not match participantUserIds', async () => {
    await expect(
      expenseService.addExpense(householdId, alice._id.toString(), {
        description: 'X',
        amount: 10,
        category: 'other',
        date: new Date().toISOString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 50 },
          { userId: carol._id.toString(), pct: 50 },
        ],
      })
    ).rejects.toThrow(/match.*participantUserIds/i);
  });
});
