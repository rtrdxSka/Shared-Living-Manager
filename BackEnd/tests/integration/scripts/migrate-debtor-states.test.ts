import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Expense } from '../../../src/models/expense.model';
import { Household } from '../../../src/models/household.model';
import { migrateDebtorStates } from '../../../scripts/migrate-debtor-states';
import { FIXTURES } from '../../seed/fixtures';

describe('migrateDebtorStates', () => {
  beforeEach(async () => {
    // Clear any prior synthetic legacy docs from previous test runs.
    await Expense.collection.deleteMany({ description: { $regex: /^MIGRATION TEST/ } });
  });

  it('backfills a legacy couple-split expense from pendingConfirmation + resolved fields', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    // Insert a doc with the OLD shape (bypass the schema using the raw collection).
    const legacyAt = new Date('2026-04-16T08:00:00.000Z');
    const _id = new Types.ObjectId();
    await Expense.collection.insertOne({
      _id,
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'MIGRATION TEST legacy pending',
      amount: 100,
      category: 'utilities',
      date: new Date('2026-04-15T12:00:00.000Z'),
      isResolved: false,
      isFullRepayment: false,
      pendingConfirmation: true,
      pendingConfirmationAt: legacyAt,
      pendingConfirmationByUserId: bob._id,
      debtorStates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const stats = await migrateDebtorStates();
    expect(stats.migrated).toBeGreaterThanOrEqual(1);

    const after = await Expense.collection.findOne({ _id });
    expect(after?.debtorStates).toHaveLength(1);
    const entry = after?.debtorStates[0];
    expect(entry?.userId.toString()).toBe(bob._id.toString());
    expect(entry?.claimedAt?.toISOString()).toBe(legacyAt.toISOString());
    // Legacy fields are gone.
    expect(after?.pendingConfirmation).toBeUndefined();
    expect(after?.pendingConfirmationAt).toBeUndefined();
    expect(after?.pendingConfirmationByUserId).toBeUndefined();
  });

  it('carries over a resolved expense as confirmedAt on the matching debtor entry', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const resolvedAt = new Date('2026-04-02T10:00:00.000Z');
    const _id = new Types.ObjectId();
    await Expense.collection.insertOne({
      _id,
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'MIGRATION TEST legacy resolved',
      amount: 80,
      category: 'rent',
      date: new Date('2026-04-01T09:00:00.000Z'),
      isResolved: true,
      isFullRepayment: false,
      resolvedAt,
      resolvedByUserId: bob._id,
      pendingConfirmation: false,
      debtorStates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await migrateDebtorStates();

    const after = await Expense.collection.findOne({ _id });
    expect(after?.debtorStates).toHaveLength(1);
    const entry = after?.debtorStates[0];
    expect(entry?.userId.toString()).toBe(bob._id.toString());
    expect(entry?.confirmedAt?.toISOString()).toBe(resolvedAt.toISOString());
    expect(after?.isResolved).toBe(true);
    expect(after?.resolvedAt?.toISOString()).toBe(resolvedAt.toISOString());
    expect(after?.resolvedByUserId).toBeUndefined();
  });

  it('is idempotent — expenses already carrying non-empty debtorStates are skipped', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const _id = new Types.ObjectId();
    const originalShare = 99; // intentionally weird so we can detect mutation.
    await Expense.collection.insertOne({
      _id,
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'MIGRATION TEST idempotent',
      amount: 100,
      category: 'groceries',
      date: new Date('2026-04-20T12:00:00.000Z'),
      isResolved: false,
      isFullRepayment: false,
      debtorStates: [{ userId: bob._id, share: originalShare }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const stats = await migrateDebtorStates();
    expect(stats.skipped).toBeGreaterThanOrEqual(1);

    const after = await Expense.collection.findOne({ _id });
    expect(after?.debtorStates).toHaveLength(1);
    expect(after?.debtorStates[0].share).toBe(originalShare);
  });

  it('handles a roommates-equal expense (3 financial members)', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');

    const _id = new Types.ObjectId();
    await Expense.collection.insertOne({
      _id,
      householdId: flatshare._id,
      paidByUserId: carol._id,
      createdByUserId: carol._id,
      description: 'MIGRATION TEST flatshare equal',
      amount: 90,
      category: 'groceries',
      date: new Date('2026-04-10T12:00:00.000Z'),
      isResolved: false,
      isFullRepayment: false,
      pendingConfirmation: false,
      debtorStates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await migrateDebtorStates();

    const after = await Expense.collection.findOne({ _id });
    expect(after?.debtorStates).toHaveLength(2);
    for (const d of after?.debtorStates ?? []) {
      expect(d.share).toBe(30);
    }
  });
});
