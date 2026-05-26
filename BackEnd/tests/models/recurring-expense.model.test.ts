import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { RecurringExpense } from '../../src/models/recurring-expense.model';

describe('RecurringExpense model — subgroup fields', () => {
  it('stores participantUserIds and customSplitOverrides on a new recurring expense', async () => {
    const u1 = new Types.ObjectId();
    const u2 = new Types.ObjectId();
    const doc = await RecurringExpense.create({
      householdId: new Types.ObjectId(),
      createdByUserId: u1,
      description: 'Netflix',
      amount: 15.99,
      category: 'subscriptions',
      interval: 'monthly',
      payerMode: 'fixed',
      fixedPayerUserId: u1,
      participantUserIds: [u1, u2],
      customSplitOverrides: [
        { userId: u1, pct: 60 },
        { userId: u2, pct: 40 },
      ],
    });
    const fetched = await RecurringExpense.findById(doc._id).lean();
    expect(fetched?.participantUserIds).toHaveLength(2);
    expect(fetched?.participantUserIds?.[0].toString()).toBe(u1.toString());
    expect(fetched?.customSplitOverrides).toHaveLength(2);
    expect(fetched?.customSplitOverrides?.[0].pct).toBe(60);
    expect(fetched?.customSplitOverrides?.[0].userId.toString()).toBe(u1.toString());
  });

  it('preserves undefined when fields are not provided', async () => {
    const doc = await RecurringExpense.create({
      householdId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      description: 'Rent',
      amount: 800,
      category: 'rent',
      interval: 'monthly',
      payerMode: 'open_to_claim',
    });
    const fetched = await RecurringExpense.findById(doc._id).lean();
    expect(fetched?.participantUserIds).toBeUndefined();
    expect(fetched?.customSplitOverrides).toBeUndefined();
  });
});
