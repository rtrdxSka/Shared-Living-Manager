import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { expenseService } from '../../../src/services/expense.service';
import { Expense } from '../../../src/models/expense.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';
import type { IAddExpenseInput } from '../../../src/types/expense.types';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

const baseAddInput = (overrides: Partial<IAddExpenseInput> = {}): IAddExpenseInput => ({
  description: 'Test expense',
  amount: 50,
  category: 'groceries',
  date: '2026-04-25',
  ...overrides,
});

// ── addExpense ───────────────────────────────────────────────────────

describe('expenseService.addExpense', () => {
  it('creates an expense for a financial member (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Add-expense happy path',
        amount: 42.5,
        category: 'utilities',
        date: '2026-05-03',
        paidByUserId: alice._id.toString(),
      })
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.description).toBe('Add-expense happy path');
    expect(result.amount).toBe(42.5);
    expect(result.category).toBe('utilities');
    expect(result.paidByUserId).toBe(alice._id.toString());
    expect(result.createdByUserId).toBe(alice._id.toString());
    expect(result.isResolved).toBe(false);
    expect(result.debtorStates).toBeDefined();
  });

  it('lets a non-admin set paidByUserId to a financial partner', async () => {
    // Bob (member role in couple) records an expense Alice actually paid.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const result = await expenseService.addExpense(
      couple._id.toString(),
      bob._id.toString(),
      baseAddInput({
        description: 'Partner paid for groceries',
        amount: 30,
        category: 'groceries',
        date: '2026-05-04',
        paidByUserId: alice._id.toString(),
      })
    );

    expect(result.paidByUserId).toBe(alice._id.toString());
    expect(result.createdByUserId).toBe(bob._id.toString());
  });

  it('rejects a non-financial member with Forbidden (403)', async () => {
    // No seeded member has participatesInFinances: false, so add a new
    // non-financial member to the flatshare household for this test.
    const flatshare = FIXTURES.household('flatshare');
    const nonFinancial = await makeUser({
      email: 'add-expense-non-financial@example.com',
    });
    await Household.updateOne(
      { _id: flatshare._id },
      {
        $push: {
          members: {
            _id: new Types.ObjectId(),
            userId: nonFinancial._id,
            nickname: 'NonFin',
            ageGroup: 'adult',
            role: 'member',
            participatesInFinances: false,
            participatesInTasks: true,
            isCreator: false,
            joinedAt: new Date(),
          },
        },
      }
    );

    await expect(
      expenseService.addExpense(
        flatshare._id.toString(),
        nonFinancial._id.toString(),
        baseAddInput({ description: 'Non-financial attempt' })
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('rejects a non-member with Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = await makeUser({ email: 'add-expense-stranger@example.com' });

    await expect(
      expenseService.addExpense(
        couple._id.toString(),
        stranger._id.toString(),
        baseAddInput()
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('auto-resolves expenses for solo households', async () => {
    const solo = FIXTURES.household('solo');
    const dave = FIXTURES.user('dave');

    const result = await expenseService.addExpense(
      solo._id.toString(),
      dave._id.toString(),
      baseAddInput({
        description: 'Solo grocery run',
        amount: 25,
        category: 'groceries',
        date: '2026-05-15',
      })
    );

    expect(result.isResolved).toBe(true);
  });

  it('split-mode expense without paidByUserId stays unresolved (not paid yet)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Pending coffee bill',
        amount: 12.5,
        category: 'other',
        date: '2026-05-17',
        // no paidByUserId — expense represents a household charge nobody has paid yet
      })
    );

    expect(result.paidByUserId).toBeUndefined();
    expect(result.isResolved).toBe(false);
    expect(result.resolvedAt).toBeUndefined();
    expect(result.debtorStates).toEqual([]);
  });
});

// ── listExpenses ─────────────────────────────────────────────────────

describe('expenseService.listExpenses', () => {
  it('returns paginated items for a household member', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await expenseService.listExpenses(
      couple._id.toString(),
      alice._id.toString(),
      { month: 'all', limit: 50 }
    );

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    // All returned items must belong to this household.
    for (const item of result.items) {
      expect(item.householdId).toBe(couple._id.toString());
    }
  });

  it('filters by status="unresolved" — excludes resolved and pending', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await expenseService.listExpenses(
      couple._id.toString(),
      alice._id.toString(),
      { month: 'all', status: 'unresolved', limit: 50 }
    );

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.isResolved).toBe(false);
      // "unresolved" filter excludes pending — no debtor entry has a claim awaiting confirmation.
      const hasPending = item.debtorStates.some((d) => d.claimedAt && !d.confirmedAt);
      expect(hasPending).toBe(false);
    }
  });

  it('rejects a non-member with Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = await makeUser({ email: 'list-expenses-stranger@example.com' });

    await expect(
      expenseService.listExpenses(
        couple._id.toString(),
        stranger._id.toString(),
        { month: 'all' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── updateExpense ────────────────────────────────────────────────────

describe('expenseService.updateExpense', () => {
  it('lets the creator update an unresolved expense', async () => {
    // Bob created groceries-week1 (unresolved).
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const expenseId = FIXTURES.expense('groceries-week1');

    const result = await expenseService.updateExpense(
      couple._id.toString(),
      bob._id.toString(),
      expenseId.toString(),
      { description: 'Groceries — week 1 (updated)', amount: 90 }
    );

    expect(result.description).toBe('Groceries — week 1 (updated)');
    expect(result.amount).toBe(90);
  });

  it('rejects updating a resolved expense with BadRequest (400)', async () => {
    // rent-april is resolved — service throws BadRequestError on resolved
    // expense edits (state-machine violation).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const expenseId = FIXTURES.expense('rent-april');

    await expect(
      expenseService.updateExpense(
        couple._id.toString(),
        alice._id.toString(),
        expenseId.toString(),
        { description: 'cannot touch this' }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('rejects a non-member with Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const expenseId = FIXTURES.expense('groceries-week1');
    const stranger = await makeUser({ email: 'update-expense-stranger@example.com' });

    await expect(
      expenseService.updateExpense(
        couple._id.toString(),
        stranger._id.toString(),
        expenseId.toString(),
        { description: 'unauthorized edit' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── deleteExpense ────────────────────────────────────────────────────

describe('expenseService.deleteExpense', () => {
  it('lets the creator delete their own unresolved expense', async () => {
    // Create a fresh unresolved expense for Alice in the couple household so
    // the test is self-contained (not dependent on seed mutation order).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'To-be-deleted expense',
        amount: 12.5,
        category: 'other',
        date: '2026-05-04',
        paidByUserId: alice._id.toString(),
      })
    );

    await expect(
      expenseService.deleteExpense(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await Expense.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });

  it('rejects deleting a resolved expense with BadRequest (400)', async () => {
    // rent-april is resolved — the service throws BadRequestError on resolved
    // expense deletes (state-machine violation).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const expenseId = FIXTURES.expense('rent-april');

    await expect(
      expenseService.deleteExpense(
        couple._id.toString(),
        alice._id.toString(),
        expenseId.toString()
      )
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('throws NotFound (404) when the expense does not exist', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      expenseService.deleteExpense(
        couple._id.toString(),
        alice._id.toString(),
        new Types.ObjectId().toString()
      )
    ).rejects.toSatisfy(expectAppError(404));
  });

  it('non-creator member is rejected with Forbidden (403)', async () => {
    // 3-member household. Carol (owner) creates an expense. Dan (member,
    // non-creator) tries to delete it → 403.
    const carol = await makeUser({ firstName: 'Carol' });
    const eve = await makeUser({ firstName: 'Eve' });
    const dan = await makeUser({ firstName: 'Dan' });
    const household = await new Household({
      name: `del-3p-${Date.now()}`,
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: carol._id,
      inviteCode: `del-3p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      members: [
        { _id: new Types.ObjectId(), userId: carol._id, nickname: 'Carol', ageGroup: 'adult', role: 'owner',  isCreator: true,  participatesInFinances: true, participatesInTasks: true },
        { _id: new Types.ObjectId(), userId: eve._id,   nickname: 'Eve',   ageGroup: 'adult', role: 'admin',  isCreator: false, participatesInFinances: true, participatesInTasks: true },
        { _id: new Types.ObjectId(), userId: dan._id,   nickname: 'Dan',   ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
      ],
      settings: {
        currency: 'EUR',
        taskManagementEnabled: 'full',
        trackedExpenseTypes: ['groceries'],
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      },
    }).save();

    const created = await expenseService.addExpense(
      household._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Pizza',
        amount: 30,
        category: 'groceries',
        date: '2026-05-15',
        paidByUserId: carol._id.toString(),
      })
    );

    await expect(
      expenseService.deleteExpense(
        household._id.toString(),
        dan._id.toString(),
        created._id
      )
    ).rejects.toSatisfy(expectAppError(403));

    // Sanity: expense is still in the DB.
    const still = await Expense.findById(created._id).lean();
    expect(still).not.toBeNull();
  });

  it('admin/owner non-creator can delete any expense', async () => {
    // Same shape household. Eve (admin) deletes Carol's expense.
    const carol = await makeUser({ firstName: 'Carol' });
    const eve = await makeUser({ firstName: 'Eve' });
    const dan = await makeUser({ firstName: 'Dan' });
    const household = await new Household({
      name: `del-3p-admin-${Date.now()}`,
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: carol._id,
      inviteCode: `del-3p-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      members: [
        { _id: new Types.ObjectId(), userId: carol._id, nickname: 'Carol', ageGroup: 'adult', role: 'owner',  isCreator: true,  participatesInFinances: true, participatesInTasks: true },
        { _id: new Types.ObjectId(), userId: eve._id,   nickname: 'Eve',   ageGroup: 'adult', role: 'admin',  isCreator: false, participatesInFinances: true, participatesInTasks: true },
        { _id: new Types.ObjectId(), userId: dan._id,   nickname: 'Dan',   ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
      ],
      settings: {
        currency: 'EUR',
        taskManagementEnabled: 'full',
        trackedExpenseTypes: ['groceries'],
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      },
    }).save();

    const created = await expenseService.addExpense(
      household._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Pizza',
        amount: 30,
        category: 'groceries',
        date: '2026-05-15',
        paidByUserId: carol._id.toString(),
      })
    );

    await expect(
      expenseService.deleteExpense(
        household._id.toString(),
        eve._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const gone = await Expense.findById(created._id).lean();
    expect(gone).toBeNull();
  });
});

// ── claimExpense ─────────────────────────────────────────────────────

describe('expenseService.claimExpense', () => {
  it('lets a financial member claim an unclaimed expense', async () => {
    // Create an unclaimed expense (omit paidByUserId), then have Bob claim it.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Unclaimed coffee run',
        amount: 8.4,
        category: 'other',
        date: '2026-05-05',
        // no paidByUserId — creates an unclaimed expense
      })
    );

    expect(created.paidByUserId).toBeUndefined();
    expect(created.debtorStates).toEqual([]);

    const claimed = await expenseService.claimExpense(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    expect(claimed._id).toBe(created._id);
    expect(claimed.paidByUserId).toBe(bob._id.toString());
    // After claim, debtorStates is populated so the OTHER financial member
    // (Alice in this couple) can use the payback flow.
    expect(claimed.debtorStates).toHaveLength(1);
    expect(claimed.debtorStates[0].userId).toBe(alice._id.toString());
    expect(claimed.debtorStates[0].claimedAt).toBeUndefined();
    expect(claimed.debtorStates[0].confirmedAt).toBeUndefined();
    expect(claimed.isResolved).toBe(false);
  });

  it('claim in a 3-member split household populates debtorStates for both non-payers', async () => {
    // Build a fresh 3-member household so the entries are easy to assert on.
    const carol = await makeUser({ firstName: 'Carol' });
    const eve = await makeUser({ firstName: 'Eve' });
    const dan = await makeUser({ firstName: 'Dan' });
    const carolMemberId = new Types.ObjectId();
    const eveMemberId = new Types.ObjectId();
    const danMemberId = new Types.ObjectId();
    const household = await new Household({
      name: `claim-3p-${Date.now()}`,
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: carol._id,
      inviteCode: `claim-3p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      members: [
        { _id: carolMemberId, userId: carol._id, nickname: 'Carol', ageGroup: 'adult', role: 'owner',  isCreator: true,  participatesInFinances: true, participatesInTasks: true },
        { _id: eveMemberId,   userId: eve._id,   nickname: 'Eve',   ageGroup: 'adult', role: 'admin',  isCreator: false, participatesInFinances: true, participatesInTasks: true },
        { _id: danMemberId,   userId: dan._id,   nickname: 'Dan',   ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
      ],
      settings: {
        currency: 'EUR',
        taskManagementEnabled: 'full',
        trackedExpenseTypes: ['groceries'],
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      },
    }).save();

    const created = await expenseService.addExpense(
      household._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Pizza',
        amount: 60,
        category: 'groceries',
        date: '2026-05-12',
      })
    );
    expect(created.debtorStates).toEqual([]);

    const claimed = await expenseService.claimExpense(
      household._id.toString(),
      carol._id.toString(),
      created._id
    );

    expect(claimed.paidByUserId).toBe(carol._id.toString());
    expect(claimed.debtorStates).toHaveLength(2);
    const debtorUserIds = claimed.debtorStates.map((d) => d.userId).sort();
    expect(debtorUserIds).toEqual([eve._id.toString(), dan._id.toString()].sort());
    for (const d of claimed.debtorStates) {
      expect(d.share).toBeCloseTo(20, 5); // equal split: 60 / 3
      expect(d.claimedAt).toBeUndefined();
      expect(d.confirmedAt).toBeUndefined();
    }
    expect(claimed.isResolved).toBe(false);

    // The debtor (Dan) can now invoke claimPayback — pre-fix this would
    // throw 'Only debtors on this expense can claim payback' because
    // debtorStates was empty.
    const afterPayback = await expenseService.claimPayback(
      household._id.toString(),
      dan._id.toString(),
      created._id
    );
    const danEntry = afterPayback.debtorStates.find((d) => d.userId === dan._id.toString());
    expect(danEntry?.claimedAt).toBeDefined();
  });

  it('claimer outside the participant subgroup joins the split and re-seeds from household %', async () => {
    // Custom-% household. An unpaid expense targets a 2-person subgroup (Alice +
    // Bob) with per-expense overrides. A third member (Carol) claims it: she must
    // join the subgroup, the stale overrides are discarded, and the split is
    // re-derived from the household percentages over all three.
    const alice = await makeUser({ firstName: 'Alice' });
    const bob = await makeUser({ firstName: 'Bob' });
    const carol = await makeUser({ firstName: 'Carol' });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const household = await new Household({
      name: `claim-join-${suffix}`,
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: alice._id,
      inviteCode: `claim-join-${suffix}`,
      members: [
        { userId: alice._id, nickname: 'Alice', ageGroup: 'adult', role: 'owner',  isCreator: true,  participatesInFinances: true, participatesInTasks: true },
        { userId: bob._id,   nickname: 'Bob',   ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
        { userId: carol._id, nickname: 'Carol', ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
      ],
      settings: {
        currency: 'EUR',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: ['groceries'],
        financeMode: 'split',
        expenseSplitMethod: 'custom',
        customSplitShares: [
          { userId: alice._id.toString(), pct: 20 },
          { userId: bob._id.toString(), pct: 30 },
          { userId: carol._id.toString(), pct: 50 },
        ],
      },
    }).save();

    const created = await expenseService.addExpense(
      household._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Groceries',
        amount: 100,
        category: 'groceries',
        date: '2026-05-20',
        // unpaid — Carol will claim it
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 40 },
          { userId: bob._id.toString(), pct: 60 },
        ],
      })
    );
    expect(created.debtorStates).toEqual([]);

    const claimed = await expenseService.claimExpense(
      household._id.toString(),
      carol._id.toString(),
      created._id
    );

    expect(claimed.paidByUserId).toBe(carol._id.toString());
    // Carol joined the subgroup; the stale per-expense overrides were dropped.
    expect(claimed.participantUserIds).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString(), carol._id.toString()])
    );
    expect(claimed.participantUserIds).toHaveLength(3);
    expect(claimed.customSplitOverrides).toBeUndefined();
    // Split re-seeded from household % over all three (20/30/50); Carol pays, so
    // only Alice and Bob owe their household shares.
    expect(claimed.debtorStates).toHaveLength(2);
    const byUser = new Map(claimed.debtorStates.map((d) => [d.userId, d.share]));
    expect(byUser.get(alice._id.toString())).toBeCloseTo(20, 5);
    expect(byUser.get(bob._id.toString())).toBeCloseTo(30, 5);
  });

  it('claimer already in the subgroup keeps the existing per-expense overrides', async () => {
    // Control for the case above: when the claimer is already a participant, the
    // subgroup and its per-expense percentages are left untouched.
    const alice = await makeUser({ firstName: 'Alice' });
    const bob = await makeUser({ firstName: 'Bob' });
    const carol = await makeUser({ firstName: 'Carol' });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const household = await new Household({
      name: `claim-keep-${suffix}`,
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: alice._id,
      inviteCode: `claim-keep-${suffix}`,
      members: [
        { userId: alice._id, nickname: 'Alice', ageGroup: 'adult', role: 'owner',  isCreator: true,  participatesInFinances: true, participatesInTasks: true },
        { userId: bob._id,   nickname: 'Bob',   ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
        { userId: carol._id, nickname: 'Carol', ageGroup: 'adult', role: 'member', isCreator: false, participatesInFinances: true, participatesInTasks: true },
      ],
      settings: {
        currency: 'EUR',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: ['groceries'],
        financeMode: 'split',
        expenseSplitMethod: 'custom',
      },
    }).save();

    const created = await expenseService.addExpense(
      household._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Groceries',
        amount: 100,
        category: 'groceries',
        date: '2026-05-21',
        participantUserIds: [alice._id.toString(), bob._id.toString()],
        customSplitOverrides: [
          { userId: alice._id.toString(), pct: 40 },
          { userId: bob._id.toString(), pct: 60 },
        ],
      })
    );

    const claimed = await expenseService.claimExpense(
      household._id.toString(),
      bob._id.toString(), // Bob is already in the subgroup
      created._id
    );

    expect(claimed.paidByUserId).toBe(bob._id.toString());
    expect(claimed.participantUserIds).toHaveLength(2);
    expect(claimed.customSplitOverrides).toHaveLength(2);
    // Overrides preserved: Bob pays, so Alice owes her 40%.
    expect(claimed.debtorStates).toHaveLength(1);
    expect(claimed.debtorStates[0].userId).toBe(alice._id.toString());
    expect(claimed.debtorStates[0].share).toBeCloseTo(40, 5);
  });
});

// ── claimPayback / confirmPayback / disputePayback ────────

describe('expense payback flow', () => {
  it('debtor claims payback, payer confirms → isResolved becomes true (couple)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — confirm',
        amount: 30,
        category: 'utilities',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    expect(created.debtorStates).toHaveLength(1);
    expect(created.debtorStates[0].userId).toBe(bob._id.toString());

    const claimed = await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );
    expect(claimed.debtorStates[0].claimedAt).toBeDefined();
    expect(claimed.isResolved).toBe(false);

    const confirmed = await expenseService.confirmPayback(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { debtorUserId: bob._id.toString() }
    );
    expect(confirmed.isResolved).toBe(true);
    expect(confirmed.debtorStates[0].confirmedAt).toBeDefined();
    expect(confirmed.resolvedAt).toBeDefined();
  });

  it('payer can dispute a pending claim, clearing claimedAt and setting disputedAt', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — dispute',
        amount: 21,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    const disputed = await expenseService.disputePayback(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { debtorUserId: bob._id.toString() }
    );

    expect(disputed.isResolved).toBe(false);
    expect(disputed.debtorStates[0].claimedAt).toBeUndefined();
    expect(disputed.debtorStates[0].disputedAt).toBeDefined();
  });

  it('non-payer cannot confirm payback → Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — wrong confirmer',
        amount: 15,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    await expect(
      expenseService.confirmPayback(
        couple._id.toString(),
        bob._id.toString(),
        created._id,
        { debtorUserId: bob._id.toString() }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('non-debtor cannot claim payback → Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — non-debtor claim',
        amount: 10,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    await expect(
      expenseService.claimPayback(
        couple._id.toString(),
        alice._id.toString(), // Alice is the payer, not a debtor.
        created._id
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('confirmPayback with debtorUserId not in debtorStates → BadRequest (400)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — bad debtor',
        amount: 10,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    // Use a valid Mongo ID that isn't on the expense.
    await expect(
      expenseService.confirmPayback(
        couple._id.toString(),
        alice._id.toString(),
        created._id,
        { debtorUserId: new Types.ObjectId().toString() }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('confirmPayback against a debtor with no pending claim → BadRequest (400)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Payback flow — no pending',
        amount: 10,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    // Bob hasn't claimed yet — confirm should reject.
    await expect(
      expenseService.confirmPayback(
        couple._id.toString(),
        alice._id.toString(),
        created._id,
        { debtorUserId: bob._id.toString() }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('confirming one of N debtors does NOT mark isResolved (the regression test for the original bug)', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const frank = FIXTURES.user('frank');

    const created = await expenseService.addExpense(
      flatshare._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Multi-debtor regression',
        amount: 90,
        category: 'groceries',
        date: '2026-05-08',
        paidByUserId: carol._id.toString(),
      })
    );

    expect(created.debtorStates.length).toBeGreaterThanOrEqual(2);

    // Both debtors claim.
    await expenseService.claimPayback(
      flatshare._id.toString(),
      eve._id.toString(),
      created._id
    );
    await expenseService.claimPayback(
      flatshare._id.toString(),
      frank._id.toString(),
      created._id
    );

    // Payer confirms only Eve.
    const partial = await expenseService.confirmPayback(
      flatshare._id.toString(),
      carol._id.toString(),
      created._id,
      { debtorUserId: eve._id.toString() }
    );

    expect(partial.isResolved).toBe(false);
    const eveEntry = partial.debtorStates.find((d) => d.userId === eve._id.toString());
    const frankEntry = partial.debtorStates.find((d) => d.userId === frank._id.toString());
    expect(eveEntry?.confirmedAt).toBeDefined();
    expect(frankEntry?.confirmedAt).toBeUndefined();
    // Frank's pending claim is preserved.
    expect(frankEntry?.claimedAt).toBeDefined();
  });

  it('confirming the last pending debtor sets isResolved=true and resolvedAt', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const frank = FIXTURES.user('frank');

    const created = await expenseService.addExpense(
      flatshare._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Multi-debtor last-confirm',
        amount: 60,
        category: 'groceries',
        date: '2026-05-09',
        paidByUserId: carol._id.toString(),
      })
    );

    await expenseService.claimPayback(
      flatshare._id.toString(),
      eve._id.toString(),
      created._id
    );
    await expenseService.claimPayback(
      flatshare._id.toString(),
      frank._id.toString(),
      created._id
    );
    await expenseService.confirmPayback(
      flatshare._id.toString(),
      carol._id.toString(),
      created._id,
      { debtorUserId: eve._id.toString() }
    );
    const final = await expenseService.confirmPayback(
      flatshare._id.toString(),
      carol._id.toString(),
      created._id,
      { debtorUserId: frank._id.toString() }
    );

    expect(final.isResolved).toBe(true);
    expect(final.resolvedAt).toBeDefined();
  });

  it('claimPayback rejects on joint-mode household', async () => {
    // The seeded "couple" household is split; we need joint. Use the solo household
    // (which has financeMode 'joint' or auto-resolves) — find one via fixtures.
    // The "couple" fixture appears to be 'split' so we make a joint-mode regression
    // using the household helper's settings. Skipping for brevity if no joint fixture
    // exists — test by directly mutating settings on the couple household.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');

    // Flip to joint temporarily to assert rejection.
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'joint' } }
    );

    await expect(
      expenseService.claimPayback(
        couple._id.toString(),
        bob._id.toString(),
        new Types.ObjectId().toString()
      )
    ).rejects.toSatisfy(expectAppError(400));

    // Restore — important so subsequent tests see the original setting.
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'split' } }
    );
  });
});

// ── addExpense debtorStates population ────────────────────────────────

describe('addExpense debtorStates population', () => {
  it('solo household → debtorStates: [] and isResolved: true', async () => {
    const solo = FIXTURES.household('solo');
    const dave = FIXTURES.user('dave');

    const result = await expenseService.addExpense(
      solo._id.toString(),
      dave._id.toString(),
      baseAddInput({
        description: 'Solo debtorStates check',
        amount: 25,
        category: 'groceries',
        date: '2026-05-15',
        paidByUserId: dave._id.toString(),
      })
    );

    expect(result.debtorStates).toEqual([]);
    expect(result.isResolved).toBe(true);
    expect(result.resolvedAt).toBeDefined();
  });

  it('couple-split with paidByUserId → 1-element debtorStates (couple uses income_based)', async () => {
    // Seeded couple has Alice=3500, Bob=2800; expenseSplitMethod=income_based.
    // Bob's share of $100 = 100 * (2800 / 6300) = 44.44.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const result = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Couple debtorStates check',
        amount: 100,
        category: 'utilities',
        date: '2026-05-20',
        paidByUserId: alice._id.toString(),
      })
    );

    expect(result.debtorStates).toHaveLength(1);
    expect(result.debtorStates[0].userId).toBe(bob._id.toString());
    expect(result.debtorStates[0].share).toBeCloseTo(44.44, 1);
    expect(result.debtorStates[0].claimedAt).toBeUndefined();
    expect(result.isResolved).toBe(false);
  });

  it('flatshare (3 financial members) → 2-element debtorStates with equal shares', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');

    const result = await expenseService.addExpense(
      flatshare._id.toString(),
      carol._id.toString(),
      baseAddInput({
        description: 'Flatshare debtorStates check',
        amount: 90,
        category: 'groceries',
        date: '2026-05-21',
        paidByUserId: carol._id.toString(),
      })
    );

    expect(result.debtorStates).toHaveLength(2);
    for (const d of result.debtorStates) {
      expect(d.share).toBe(30);
    }
    expect(result.isResolved).toBe(false);
  });

  it('isFullRepayment → debtor owes full amount, stays unresolved pending claim/confirm', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const result = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Full repayment debtorStates check',
        amount: 200,
        category: 'rent',
        date: '2026-05-22',
        paidByUserId: alice._id.toString(),
        isFullRepayment: true,
      })
    );

    expect(result.debtorStates).toHaveLength(1);
    expect(result.debtorStates[0].userId).toBe(bob._id.toString());
    expect(result.debtorStates[0].share).toBe(200);
    expect(result.debtorStates[0].claimedAt).toBeUndefined();
    expect(result.debtorStates[0].confirmedAt).toBeUndefined();
    expect(result.isFullRepayment).toBe(true);
    expect(result.isResolved).toBe(false);
    expect(result.resolvedAt).toBeUndefined();
  });

  it('isFullRepayment → debtor claims, payer confirms → resolved', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Full repayment end-to-end',
        amount: 200,
        category: 'rent',
        date: '2026-05-22',
        paidByUserId: alice._id.toString(),
        isFullRepayment: true,
      })
    );
    expect(created.isResolved).toBe(false);
    expect(created.debtorStates[0].share).toBe(200);

    const claimed = await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );
    expect(claimed.debtorStates[0].claimedAt).toBeDefined();
    expect(claimed.debtorStates[0].confirmedAt).toBeUndefined();
    expect(claimed.isResolved).toBe(false);

    const confirmed = await expenseService.confirmPayback(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { debtorUserId: bob._id.toString() }
    );
    expect(confirmed.debtorStates[0].confirmedAt).toBeDefined();
    expect(confirmed.isResolved).toBe(true);
    expect(confirmed.resolvedAt).toBeDefined();
  });
});
