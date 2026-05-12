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
    expect(result.pendingConfirmation).toBe(false);
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
      expect(item.pendingConfirmation).toBe(false);
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

    const claimed = await expenseService.claimExpense(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    expect(claimed._id).toBe(created._id);
    expect(claimed.paidByUserId).toBe(bob._id.toString());
  });
});

// ── requestResolution / confirmResolution / disputeResolution ────────

describe('expense resolution flow', () => {
  it('non-payer requests, payer confirms → isResolved becomes true', async () => {
    // Create an expense paid by Alice; Bob (non-payer) requests resolution;
    // Alice (payer) confirms receipt.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Resolution flow — confirm',
        amount: 30,
        category: 'utilities',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    // Bob (non-payer) requests resolution.
    const requested = await expenseService.requestResolution(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );
    expect(requested.pendingConfirmation).toBe(true);
    expect(requested.isResolved).toBe(false);

    // Alice (payer) confirms.
    const confirmed = await expenseService.confirmResolution(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );
    expect(confirmed.isResolved).toBe(true);
    expect(confirmed.pendingConfirmation).toBe(false);
    expect(confirmed.resolvedByUserId).toBe(alice._id.toString());
  });

  it('payer can dispute a pending resolution, clearing pendingConfirmation', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Resolution flow — dispute',
        amount: 21,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    // Bob requests resolution.
    await expenseService.requestResolution(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    // Alice (payer) disputes.
    const disputed = await expenseService.disputeResolution(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    expect(disputed.pendingConfirmation).toBe(false);
    expect(disputed.isResolved).toBe(false);
    expect(disputed.lastDisputedAt).toBeTypeOf('string');
  });

  it('non-payer cannot confirm resolution → Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      baseAddInput({
        description: 'Resolution flow — wrong confirmer',
        amount: 15,
        category: 'other',
        date: '2026-05-06',
        paidByUserId: alice._id.toString(),
      })
    );

    // Bob (non-payer) requests resolution — valid.
    await expenseService.requestResolution(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );

    // Bob attempts to confirm his own request — should be forbidden;
    // only Alice (the payer) may confirm.
    await expect(
      expenseService.confirmResolution(
        couple._id.toString(),
        bob._id.toString(),
        created._id
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});
