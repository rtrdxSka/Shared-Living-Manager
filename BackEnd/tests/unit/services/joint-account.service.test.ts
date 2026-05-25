import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { jointAccountService } from '../../../src/services/joint-account.service';
import { JointAccountTransaction } from '../../../src/models/joint-account-transaction.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── getSummary ───────────────────────────────────────────────────────

describe('jointAccountService.getSummary', () => {
  it('returns summary for a financial member (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.getSummary(
      couple._id.toString(),
      alice._id.toString(),
      '2026-04'
    );

    // Seeded couple txs (April): deposits = 500 + 400 = 900, withdrawals = 120 + 60 = 180.
    expect(result.monthlyDeposits).toBe(900);
    expect(result.monthlyWithdrawals).toBe(180);
    // monthlyTarget seeded as 900, targetMode 'proportional'.
    expect(result.monthlyTarget).toBe(900);
    expect(result.targetMode).toBe('proportional');
    // Both Alice & Bob are financial members → breakdown has 2 entries.
    expect(result.memberBreakdown.length).toBe(2);
    // Transactions list returned (paginated) — at least the seeded April txs.
    expect(Array.isArray(result.transactions)).toBe(true);
    expect(result.transactionTotal).toBeGreaterThanOrEqual(4);
  });

  it('rejects a non-member with Forbidden (403)', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = await makeUser({
      email: 'ja-summary-stranger@example.com',
    });

    await expect(
      jointAccountService.getSummary(
        couple._id.toString(),
        stranger._id.toString()
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── getSummary: unified activity feed ────────────────────────────────
// The Recent Activity feed merges joint-account transactions AND expenses
// (which already reduce the balance) into one date-sorted list.

describe('jointAccountService.getSummary — activity feed', () => {
  it('merges expenses and transactions into one date-desc feed', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.getSummary(
      couple._id.toString(),
      alice._id.toString(),
      '2026-04'
    );

    // April couple: 4 transactions (tx-1..tx-4) + 4 expenses = 8 activity items.
    expect(result.activityTotal).toBe(8);
    expect(result.activity).toHaveLength(8);

    // Sorted by date descending.
    for (let i = 1; i < result.activity.length; i++) {
      expect(
        new Date(result.activity[i - 1].date).getTime()
      ).toBeGreaterThanOrEqual(new Date(result.activity[i].date).getTime());
    }

    // Latest April event is tx-4 (withdrawal 60 at 20:30), just after the
    // "Dinner at Manastira" expense (64 at 20:00).
    expect(result.activity[0]).toMatchObject({
      kind: 'transaction',
      type: 'withdrawal',
      amount: 60,
    });
    expect(result.activity[1]).toMatchObject({
      kind: 'expense',
      type: 'expense',
      amount: 64,
      category: 'other',
      note: 'Dinner at Manastira',
      memberNickname: 'Bob',
    });
  });

  it('represents expenses as positive-amount outflows with payer + category', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.getSummary(
      couple._id.toString(),
      alice._id.toString(),
      '2026-04'
    );

    const rent = result.activity.find((a) => a.note === 'April Rent');
    expect(rent).toMatchObject({
      kind: 'expense',
      type: 'expense',
      amount: 1200,
      category: 'rent',
      memberNickname: 'Alice',
    });
    expect(rent?._id).toBeTypeOf('string');
  });

  it('paginates the merged feed', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.getSummary(
      couple._id.toString(),
      alice._id.toString(),
      '2026-04',
      { page: 1, limit: 5 }
    );

    expect(result.activityTotal).toBe(8);
    expect(result.activity).toHaveLength(5);
    expect(result.activityPage).toBe(1);
    expect(result.activityTotalPages).toBe(2);
  });
});

// ── addTransaction ───────────────────────────────────────────────────

describe('jointAccountService.addTransaction', () => {
  it('creates a deposit for a financial member (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.addTransaction(
      couple._id.toString(),
      alice._id.toString(),
      { type: 'deposit', amount: 75.5, note: 'Mid-month top-up' }
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.type).toBe('deposit');
    expect(result.amount).toBe(75.5);
    expect(result.note).toBe('Mid-month top-up');
    expect(result.userId).toBe(alice._id.toString());
    expect(result.memberNickname).toBe('Alice');
  });

  it('rejects a non-financial member with Forbidden (403)', async () => {
    // No seeded user has participatesInFinances: false, so push a fresh
    // non-financial member onto the flatshare for this test.
    const flatshare = FIXTURES.household('flatshare');
    const nonFinancial = await makeUser({
      email: 'ja-add-non-financial@example.com',
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
      jointAccountService.addTransaction(
        flatshare._id.toString(),
        nonFinancial._id.toString(),
        { type: 'deposit', amount: 25 }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('rejects a withdrawal that exceeds the current balance with BadRequest (400)', async () => {
    // Couple's balance is heavily negative because seeded expenses (2696.7) far
    // exceed seeded contributions (900 - 180 = 720). Any withdrawal > balance
    // should fail.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      jointAccountService.addTransaction(
        couple._id.toString(),
        alice._id.toString(),
        { type: 'withdrawal', amount: 99999 }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── deleteTransaction ────────────────────────────────────────────────

describe('jointAccountService.deleteTransaction', () => {
  it('lets the creator delete their own transaction', async () => {
    // Alice created tx-1 (deposit 500).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const txId = FIXTURES.jointTx('tx-1');

    await expect(
      jointAccountService.deleteTransaction(
        couple._id.toString(),
        alice._id.toString(),
        txId.toString()
      )
    ).resolves.toBeUndefined();

    const stillThere = await JointAccountTransaction.findById(txId).lean();
    expect(stillThere).toBeNull();
  });
});

// ── updateConfig ─────────────────────────────────────────────────────

describe('jointAccountService.updateConfig', () => {
  it('lets an owner update the monthly target', async () => {
    // Alice is the owner of the couple household.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await jointAccountService.updateConfig(
      couple._id.toString(),
      alice._id.toString(),
      { monthlyTarget: 1100, targetMode: 'equal' }
    );

    expect(result._id).toBe(couple._id.toString());
    expect(result.settings.jointAccountConfig?.monthlyTarget).toBe(1100);
    expect(result.settings.jointAccountConfig?.targetMode).toBe('equal');
  });

  it('rejects a non-admin member with Forbidden (403)', async () => {
    // Bob is role 'member' in the couple — neither owner nor admin.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');

    await expect(
      jointAccountService.updateConfig(
        couple._id.toString(),
        bob._id.toString(),
        { monthlyTarget: 500 }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});
