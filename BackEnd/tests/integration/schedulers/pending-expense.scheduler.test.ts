import { describe, it, expect } from 'vitest';
import { expenseService } from '../../../src/services/expense.service';
import { Expense } from '../../../src/models/expense.model';
import { FIXTURES } from '../../seed/fixtures';

describe('expenseService.autoConfirmExpiredPending (pending-expense scheduler worker)', () => {
  it('confirms an expense pending > 48h and returns count >= 1', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const expenseId = FIXTURES.expense('rent-may'); // alice paid, bob is the debtor

    // Arrange via service — production path that populates debtorStates[bob].claimedAt.
    await expenseService.claimPayback(
      couple._id.toString(),
      bob._id.toString(),
      expenseId.toString()
    );
    // Backdate the per-debtor claimedAt — only reachable via Model.updateOne.
    await Expense.updateOne(
      { _id: expenseId, 'debtorStates.userId': bob._id },
      { $set: { 'debtorStates.$.claimedAt': new Date(Date.now() - 49 * 60 * 60 * 1000) } }
    );

    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBeGreaterThanOrEqual(1);

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).toBe(true);
    const bobEntry = after?.debtorStates.find(
      (d) => d.userId.toString() === bob._id.toString()
    );
    expect(bobEntry?.confirmedAt).toBeDefined();
  });

  it('leaves an expense whose pending claim is < 48h untouched', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const expenseId = FIXTURES.expense('dinner-out'); // bob paid, alice is the debtor

    await expenseService.claimPayback(
      couple._id.toString(),
      alice._id.toString(),
      expenseId.toString()
    );

    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).not.toBe(true);
    const aliceEntry = after?.debtorStates.find(
      (d) => d.userId.toString() === alice._id.toString()
    );
    expect(aliceEntry?.claimedAt).toBeDefined();
    expect(aliceEntry?.confirmedAt).toBeUndefined();
  });

  it('returns 0 when no expense has a pending claim', async () => {
    // Clear every debtor's claimedAt across all expenses.
    await Expense.updateMany(
      {},
      { $unset: { 'debtorStates.$[].claimedAt': '' } }
    );

    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBe(0);
  });

  it('flips isResolved=true only when the last pending debtor is auto-confirmed', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const frank = FIXTURES.user('frank');

    // Seed a fresh multi-debtor expense paid by Carol.
    const created = await expenseService.addExpense(
      flatshare._id.toString(),
      carol._id.toString(),
      {
        description: 'Multi-debtor scheduler test',
        amount: 60,
        category: 'groceries',
        date: '2026-05-09',
        paidByUserId: carol._id.toString(),
      }
    );

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

    // Backdate only Eve's claim past the 48h cutoff.
    await Expense.updateOne(
      { _id: created._id, 'debtorStates.userId': eve._id },
      { $set: { 'debtorStates.$.claimedAt': new Date(Date.now() - 49 * 60 * 60 * 1000) } }
    );

    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(created._id).lean();
    const eveEntry = after?.debtorStates.find((d) => d.userId.toString() === eve._id.toString());
    const frankEntry = after?.debtorStates.find((d) => d.userId.toString() === frank._id.toString());
    expect(eveEntry?.confirmedAt).toBeDefined();
    expect(frankEntry?.confirmedAt).toBeUndefined();
    expect(after?.isResolved).toBe(false);
  });

  it('skips expenses that are already resolved (proves the isResolved:false filter)', async () => {
    const expenseId = FIXTURES.expense('groceries-week1');
    // Backdate a claim then mark the expense already resolved.
    await Expense.updateOne(
      { _id: expenseId },
      {
        $set: {
          isResolved: true,
          'debtorStates.0.claimedAt': new Date(Date.now() - 49 * 60 * 60 * 1000),
        },
      }
    );

    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).toBe(true);
    // The expense should NOT have been re-touched — the filter excludes resolved.
    const firstEntry = after?.debtorStates[0];
    expect(firstEntry?.confirmedAt).toBeUndefined();
  });
});
