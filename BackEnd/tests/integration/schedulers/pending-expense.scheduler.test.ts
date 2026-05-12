import { describe, it, expect } from 'vitest';
import { expenseService } from '../../../src/services/expense.service';
import { Expense } from '../../../src/models/expense.model';
import { FIXTURES } from '../../seed/fixtures';

describe('expenseService.autoConfirmExpiredPending (pending-expense scheduler worker)', () => {
  it('confirms an expense pending > 48h and returns count >= 1', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const expenseId = FIXTURES.expense('rent-may'); // alice paid, bob is non-payer requester

    // Arrange via service — production path that sets pendingConfirmation flags.
    await expenseService.requestResolution(
      couple._id.toString(),
      bob._id.toString(),
      expenseId.toString()
    );
    // Backdate the timestamp — service cannot reach this field.
    await Expense.updateOne(
      { _id: expenseId },
      { pendingConfirmationAt: new Date(Date.now() - 49 * 60 * 60 * 1000) }
    );

    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBeGreaterThanOrEqual(1);

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).toBe(true);
    expect(after?.pendingConfirmation).toBe(false);
    expect(after?.resolvedByUserId?.toString()).toBe(bob._id.toString());
  });

  it('leaves an expense pending < 48h untouched', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const expenseId = FIXTURES.expense('dinner-out'); // bob paid, alice is non-payer requester

    await expenseService.requestResolution(
      couple._id.toString(),
      alice._id.toString(),
      expenseId.toString()
    );

    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).not.toBe(true);
    expect(after?.pendingConfirmation).toBe(true);
  });

  it('returns 0 when no expense has pendingConfirmation set', async () => {
    await Expense.updateMany({}, { pendingConfirmation: false });

    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBe(0);
  });

  it('skips expenses that are already resolved (proves the isResolved:false filter)', async () => {
    const expenseId = FIXTURES.expense('groceries-week1');
    await Expense.updateOne(
      { _id: expenseId },
      {
        isResolved: true,
        pendingConfirmation: true,
        pendingConfirmationAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      }
    );

    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(expenseId).lean();
    expect(after?.pendingConfirmation).toBe(true);
    expect(after?.isResolved).toBe(true);
  });
});
