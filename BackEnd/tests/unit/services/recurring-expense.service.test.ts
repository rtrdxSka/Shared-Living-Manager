import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { recurringExpenseService } from '../../../src/services/recurring-expense.service';
import { RecurringExpense } from '../../../src/models/recurring-expense.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';
import type {
  ICreateRecurringExpenseInput,
} from '../../../src/types/recurring-expense.types';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

const baseFixedInput = (
  fixedPayerUserId: string,
  overrides: Partial<ICreateRecurringExpenseInput> = {}
): ICreateRecurringExpenseInput => ({
  description: 'Monthly Rent Template',
  amount: 800,
  category: 'rent',
  interval: 'monthly',
  payerMode: 'fixed',
  fixedPayerUserId,
  ...overrides,
});

// ── create ──────────────────────────────────────────────────────────

describe('recurringExpenseService.create', () => {
  it('creates a fixed-payer template for a financial member (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseFixedInput(alice._id.toString(), {
        description: 'Recurring rent — happy path',
        amount: 850,
      })
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.createdByUserId).toBe(alice._id.toString());
    expect(result.description).toBe('Recurring rent — happy path');
    expect(result.amount).toBe(850);
    expect(result.category).toBe('rent');
    expect(result.interval).toBe('monthly');
    expect(result.payerMode).toBe('fixed');
    expect(result.fixedPayerUserId).toBe(alice._id.toString());
    expect(result.fixedPayerNickname).toBe('Alice');
    expect(result.isActive).toBe(true);
    expect(result.isFullRepayment).toBe(false);
  });

  it('rejects a non-financial member with Forbidden (403)', async () => {
    // No seeded member has participatesInFinances: false, so add a new
    // non-financial member to the flatshare household for this test.
    const flatshare = FIXTURES.household('flatshare');
    const nonFinancial = await makeUser({
      email: 'rec-exp-non-financial@example.com',
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
      recurringExpenseService.create(
        flatshare._id.toString(),
        nonFinancial._id.toString(),
        baseFixedInput(nonFinancial._id.toString())
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('rejects fixed payerMode without fixedPayerUserId with BadRequest (400)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      recurringExpenseService.create(
        couple._id.toString(),
        alice._id.toString(),
        {
          description: 'Missing fixedPayer',
          amount: 100,
          category: 'utilities',
          interval: 'monthly',
          payerMode: 'fixed',
          // fixedPayerUserId intentionally omitted
        }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── list ────────────────────────────────────────────────────────────

describe('recurringExpenseService.list', () => {
  it('returns active templates for a household member', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    // Seed an active template directly so listing has something to find.
    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseFixedInput(alice._id.toString(), {
        description: 'List-test active template',
        amount: 120,
        category: 'utilities',
      })
    );

    const list = await recurringExpenseService.list(
      couple._id.toString(),
      alice._id.toString()
    );

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    const found = list.find((t) => t._id === created._id);
    expect(found).toBeDefined();
    expect(found!.isActive).toBe(true);
    expect(found!.householdId).toBe(couple._id.toString());
  });
});

// ── update ──────────────────────────────────────────────────────────

describe('recurringExpenseService.update', () => {
  it('lets an admin/owner update financial fields (amount)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice'); // owner

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseFixedInput(alice._id.toString(), {
        description: 'Update-amount target',
        amount: 200,
        category: 'utilities',
      })
    );

    const updated = await recurringExpenseService.update(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { amount: 250 }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.amount).toBe(250);
  });

  it('rejects a non-admin updating a financial field (amount) with Forbidden (403)', async () => {
    // Bob (member, not admin) created a template — bob is not owner/admin,
    // so even on his own template he cannot modify financial fields.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      bob._id.toString(),
      baseFixedInput(bob._id.toString(), {
        description: 'Bob non-admin financial update target',
        amount: 50,
        category: 'groceries',
      })
    );

    await expect(
      recurringExpenseService.update(
        couple._id.toString(),
        bob._id.toString(),
        created._id,
        { amount: 75 }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('lets an admin who did not create the template update non-financial fields', async () => {
    // Carol (flatshare owner) creates the template; Eve (flatshare admin)
    // updates the description (a non-financial field) — admin bypass should
    // allow this. The point is the creator-bypass, not the financial-field
    // gate, so we change description only.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringExpenseService.create(
      flatshare._id.toString(),
      carol._id.toString(),
      baseFixedInput(carol._id.toString(), {
        description: 'Admin-bypass update target',
        amount: 90,
        category: 'utilities',
      })
    );

    const updated = await recurringExpenseService.update(
      flatshare._id.toString(),
      eve._id.toString(),
      created._id,
      { description: 'Admin-bypass update — renamed' }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.description).toBe('Admin-bypass update — renamed');
  });
});

// ── deactivate ──────────────────────────────────────────────────────

describe('recurringExpenseService.deactivate', () => {
  it('lets the creator deactivate a template — drops out of list', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseFixedInput(alice._id.toString(), {
        description: 'To-be-deactivated template',
        amount: 60,
        category: 'other',
      })
    );

    await expect(
      recurringExpenseService.deactivate(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    // Confirm it is no longer present in the active list.
    const list = await recurringExpenseService.list(
      couple._id.toString(),
      alice._id.toString()
    );
    expect(list.find((t) => t._id === created._id)).toBeUndefined();

    // Underlying doc should be flagged inactive (not deleted).
    const stillThere = await RecurringExpense.findById(created._id).lean();
    expect(stillThere).not.toBeNull();
    expect(stillThere!.isActive).toBe(false);
  });

  it('lets an admin who did not create the template deactivate it', async () => {
    // Carol (flatshare owner) creates the template; Eve (flatshare admin)
    // deactivates it — admin bypass should allow.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringExpenseService.create(
      flatshare._id.toString(),
      carol._id.toString(),
      baseFixedInput(carol._id.toString(), {
        description: 'Admin-bypass deactivate target',
        amount: 70,
        category: 'utilities',
      })
    );

    await expect(
      recurringExpenseService.deactivate(
        flatshare._id.toString(),
        eve._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await RecurringExpense.findById(created._id).lean();
    expect(stillThere).not.toBeNull();
    expect(stillThere!.isActive).toBe(false);
  });
});
