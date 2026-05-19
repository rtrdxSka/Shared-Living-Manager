import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { budgetService } from '../../../src/services/budget.service';
import { Budget } from '../../../src/models/budget.model';
import { BudgetSnapshot } from '../../../src/models/budget-snapshot.model';
import { Expense } from '../../../src/models/expense.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── getCurrent ────────────────────────────────────────────────────────

describe('budgetService.getCurrent', () => {
  it('returns the standing budget, lazily creating an empty one when none exists', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.deleteOne({ householdId: couple._id });
    const result = await budgetService.getCurrent(couple._id.toString(), alice._id.toString());

    expect(result.householdId.toString()).toBe(couple._id.toString());
    expect(result.categories).toEqual({});
  });

  it('forbids non-members with 403', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = new Types.ObjectId().toString();
    await expect(
      budgetService.getCurrent(couple._id.toString(), stranger)
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── update ────────────────────────────────────────────────────────────

describe('budgetService.update', () => {
  it('replaces categories and bumps updatedAt', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice'); // owner

    const updated = await budgetService.update(
      couple._id.toString(),
      alice._id.toString(),
      { categories: { groceries: 300, subscriptions: 50 } }
    );
    expect(updated.categories.groceries).toBe(300);
    expect(updated.categories.subscriptions).toBe(50);
  });

  it('snapshots OLD values for the previous month before applying the edit, if no snapshot exists', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { groceries: 200 } },
      { upsert: true, new: true }
    );
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthString = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    await BudgetSnapshot.deleteOne({ householdId: couple._id, monthString: prevMonthString });

    await budgetService.update(
      couple._id.toString(),
      alice._id.toString(),
      { categories: { groceries: 350 } }
    );

    const snap = await BudgetSnapshot.findOne({ householdId: couple._id, monthString: prevMonthString });
    expect(snap).not.toBeNull();
    expect(snap!.categories.groceries).toBe(200);
  });

  it('forbids non-admin members with 403', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob'); // role 'member', not admin
    await expect(
      budgetService.update(couple._id.toString(), bob._id.toString(), { categories: { groceries: 100 } })
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('rejects negative amounts with 400', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await expect(
      budgetService.update(couple._id.toString(), alice._id.toString(), { categories: { groceries: -1 } })
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('rejects unknown category keys with 400', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await expect(
      budgetService.update(
        couple._id.toString(),
        alice._id.toString(),
        { categories: { bogus: 100 } as unknown as Record<string, number> }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── getForMonth ───────────────────────────────────────────────────────

describe('budgetService.getForMonth', () => {
  it('returns live budget for current month', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { rent: 500 } },
      { upsert: true }
    );
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await budgetService.getForMonth(couple._id.toString(), alice._id.toString(), current);
    expect(result.source).toBe('live');
    expect(result.categories.rent).toBe(500);
  });

  it('lazy-creates a snapshot when a past month has none', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { rent: 600 } },
      { upsert: true }
    );
    const past = '2024-01';
    await BudgetSnapshot.deleteOne({ householdId: couple._id, monthString: past });
    const result = await budgetService.getForMonth(couple._id.toString(), alice._id.toString(), past);
    expect(result.source).toBe('snapshot');
    expect(result.categories.rent).toBe(600);
    const created = await BudgetSnapshot.findOne({ householdId: couple._id, monthString: past });
    expect(created).not.toBeNull();
  });
});

// ── getInsights ───────────────────────────────────────────────────────

describe('budgetService.getInsights', () => {
  it('aggregates spend-by-category and flags over-budget categories', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { groceries: 100, subscriptions: 50 } },
      { upsert: true }
    );

    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await Expense.create({
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'Food shop',
      amount: 120,
      category: 'groceries',
      date: new Date(now.getFullYear(), now.getMonth(), 15),
      isFullRepayment: false,
    });
    await Expense.create({
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'Netflix',
      amount: 30,
      category: 'subscriptions',
      date: new Date(now.getFullYear(), now.getMonth(), 16),
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      couple._id.toString(),
      alice._id.toString(),
      monthString
    );

    expect(insights.month).toBe(monthString);
    expect(insights.spendByCategory.groceries).toBeGreaterThanOrEqual(120);
    expect(insights.spendByCategory.subscriptions).toBeGreaterThanOrEqual(30);
    expect(insights.overBudgetCategories).toContain('groceries');
    expect(insights.monthlyTrend).toHaveLength(6);
    expect(insights.monthlyTrend[5].monthString).toBe(monthString);
  });

  it('returns savingsRate when the requesting member has monthlyIncome set', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Household.updateOne(
      { _id: couple._id, 'members.userId': alice._id },
      { $set: { 'members.$.monthlyIncome': 1000 } }
    );
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const insights = await budgetService.getInsights(
      couple._id.toString(),
      alice._id.toString(),
      monthString
    );
    expect(insights.monthlyIncome).toBe(1000);
    expect(insights.savingsRate).not.toBeNull();
    expect(insights.savingsRate!).toBeGreaterThanOrEqual(0);
    expect(insights.savingsRate!).toBeLessThanOrEqual(1);
  });

  it('returns null savingsRate when monthlyIncome is unset', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    await Household.updateOne(
      { _id: couple._id, 'members.userId': bob._id },
      { $unset: { 'members.$.monthlyIncome': '' } }
    );
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const insights = await budgetService.getInsights(
      couple._id.toString(),
      bob._id.toString(),
      monthString
    );
    expect(insights.monthlyIncome).toBeNull();
    expect(insights.savingsRate).toBeNull();
  });
});
