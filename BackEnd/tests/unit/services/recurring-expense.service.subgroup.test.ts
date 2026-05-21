import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { recurringExpenseService } from '../../../src/services/recurring-expense.service';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';
import { Expense } from '../../../src/models/expense.model';
import { RecurringExpense } from '../../../src/models/recurring-expense.model';

// Counter used to generate unique emails / invite codes per beforeEach run
// (the setup seed runs once per file in beforeAll — these test rows must not
// collide with each other across cases in this describe block).
let counter = 0;

describe('recurringExpenseService — subgroup validation', () => {
  let householdId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alice: any, bob: any, carol: any;

  beforeEach(async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;
    alice = await new User({
      email: `rec-subgroup-alice-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    bob = await new User({
      email: `rec-subgroup-bob-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    carol = await new User({
      email: `rec-subgroup-carol-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Carol',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();

    const h = await new Household({
      name: 'Recurring Subgroup Test House',
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: alice._id,
      inviteCode: `rec-subgroup-invite-${suffix}`,
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
          role: 'admin',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: carol._id,
          nickname: 'Carol',
          ageGroup: 'adult',
          role: 'admin',
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
    const tpl = await recurringExpenseService.create(
      householdId,
      alice._id.toString(),
      {
        description: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
      }
    );

    expect(tpl.participantUserIds).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString()])
    );
    expect(tpl.participantUserIds).toHaveLength(2);
  });

  it('rejects when payer is not in the participant subgroup', async () => {
    await expect(
      recurringExpenseService.create(householdId, alice._id.toString(), {
        description: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: carol._id.toString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
      })
    ).rejects.toThrow(/payer.*not.*in.*participants/i);
  });

  it('rejects when a participantUserId is not a household member', async () => {
    const stranger = new Types.ObjectId().toString();
    await expect(
      recurringExpenseService.create(householdId, alice._id.toString(), {
        description: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'open_to_claim',
        participantUserIds: [alice._id.toString(), stranger],
      })
    ).rejects.toThrow(/not.*finance|not.*member/i);
  });

  it('accepts customSplitOverrides summing to 100', async () => {
    const tpl = await recurringExpenseService.create(
      householdId,
      alice._id.toString(),
      {
        description: 'Gym',
        amount: 60,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
        participantUserIds: [
          alice._id.toString(),
          bob._id.toString(),
          carol._id.toString(),
        ],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 50 },
          { userId: bob._id.toString(), pct: 30 },
          { userId: carol._id.toString(), pct: 20 },
        ],
      }
    );

    expect(tpl.customSplitOverrides).toHaveLength(3);
  });

  it('rejects customSplitOverrides not summing to 100', async () => {
    await expect(
      recurringExpenseService.create(householdId, alice._id.toString(), {
        description: 'Gym',
        amount: 60,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'open_to_claim',
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
      recurringExpenseService.create(householdId, alice._id.toString(), {
        description: 'Gym',
        amount: 60,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'open_to_claim',
        customSplitOverrides: [{ userId: alice._id.toString(), pct: 100 }],
      })
    ).rejects.toThrow(/customSplitOverrides.*requires.*participantUserIds/i);
  });

  it('rejects customSplitOverrides whose userIds do not match participantUserIds', async () => {
    await expect(
      recurringExpenseService.create(householdId, alice._id.toString(), {
        description: 'Gym',
        amount: 60,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'open_to_claim',
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 50 },
          { userId: carol._id.toString(), pct: 50 },
        ],
      })
    ).rejects.toThrow(/match.*participantUserIds/i);
  });

  it('carries participantUserIds + customSplitOverrides into generated expense instances', async () => {
    const tpl = await recurringExpenseService.create(
      householdId,
      alice._id.toString(),
      {
        description: 'Spotify Family',
        amount: 17.99,
        category: 'subscriptions',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 60 },
          { userId: bob._id.toString(), pct: 40 },
        ],
      }
    );

    // Trigger generation — the service queries by interval + isActive.
    await recurringExpenseService.generateInstances('monthly');

    const instance = await Expense.findOne({
      recurringExpenseId: new Types.ObjectId(tpl._id),
    });
    expect(instance).not.toBeNull();
    expect(instance!.participantUserIds?.map((id) => id.toString())).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString()])
    );
    expect(instance!.participantUserIds).toHaveLength(2);
    expect(instance!.customSplitOverrides).toHaveLength(2);
    const aliceOverride = instance!.customSplitOverrides!.find(
      (o) => o.userId.toString() === alice._id.toString()
    );
    expect(aliceOverride?.pct).toBe(60);
    const bobOverride = instance!.customSplitOverrides!.find(
      (o) => o.userId.toString() === bob._id.toString()
    );
    expect(bobOverride?.pct).toBe(40);

    // Cleanup so we don't pollute other tests (the unique index on
    // recurringExpenseId + date would otherwise block re-runs in this file
    // if it ran in a non-isolated suite).
    await Expense.deleteOne({ _id: instance!._id });
    await RecurringExpense.deleteOne({ _id: tpl._id });
  });
});
