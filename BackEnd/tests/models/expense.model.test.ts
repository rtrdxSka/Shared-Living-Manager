import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { Expense } from '../../src/models/expense.model';

describe('Expense model — subgroup fields', () => {
  it('stores participantUserIds and customSplitOverrides on a new expense', async () => {
    const u1 = new Types.ObjectId();
    const u2 = new Types.ObjectId();
    const u3 = new Types.ObjectId();
    const doc = await Expense.create({
      householdId: new Types.ObjectId(),
      createdByUserId: u1,
      paidByUserId: u1,
      description: 'Netflix',
      amount: 15.99,
      category: 'subscriptions',
      date: new Date(),
      participantUserIds: [u1, u2, u3],
      customSplitOverrides: [
        { userId: u1, pct: 40 },
        { userId: u2, pct: 30 },
        { userId: u3, pct: 30 },
      ],
    });
    const fetched = await Expense.findById(doc._id).lean();
    expect(fetched?.participantUserIds).toHaveLength(3);
    expect(fetched?.participantUserIds?.[0].toString()).toBe(u1.toString());
    expect(fetched?.customSplitOverrides).toHaveLength(3);
    expect(fetched?.customSplitOverrides?.[0].pct).toBe(40);
    expect(fetched?.customSplitOverrides?.[0].userId.toString()).toBe(u1.toString());
  });

  it('preserves undefined when fields are not provided', async () => {
    const doc = await Expense.create({
      householdId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      description: 'Bills',
      amount: 50,
      category: 'utilities',
      date: new Date(),
    });
    const fetched = await Expense.findById(doc._id).lean();
    expect(fetched?.participantUserIds).toBeUndefined();
    expect(fetched?.customSplitOverrides).toBeUndefined();
  });
});
