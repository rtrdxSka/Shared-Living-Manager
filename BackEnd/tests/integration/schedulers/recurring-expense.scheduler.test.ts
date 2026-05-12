import { describe, it, expect } from 'vitest';
import { recurringExpenseService } from '../../../src/services/recurring-expense.service';
import { Expense } from '../../../src/models/expense.model';
import { FIXTURES } from '../../seed/fixtures';

function monthlyPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

describe('recurringExpenseService.generateInstances (recurring-expense scheduler worker)', () => {
  it('spawns one Expense per active monthly template', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const description = `Auto Rent ${ts}`;

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      {
        description,
        amount: 1200,
        category: 'rent',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
      }
    );

    await recurringExpenseService.generateInstances('monthly');

    const spawned = await Expense.find({ recurringExpenseId: created._id }).lean();
    expect(spawned).toHaveLength(1);
    expect(spawned[0].amount).toBe(1200);
    expect(spawned[0].date.getTime()).toBeGreaterThanOrEqual(monthlyPeriodStart().getTime());
  });

  it('is idempotent — two calls in the same period spawn one instance', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      {
        description: `Idempo Rent ${ts}`,
        amount: 500,
        category: 'rent',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
      }
    );

    await recurringExpenseService.generateInstances('monthly');
    await recurringExpenseService.generateInstances('monthly');

    const count = await Expense.countDocuments({ recurringExpenseId: created._id });
    expect(count).toBe(1);
  });

  it('only spawns for the requested interval', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const monthly = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      {
        description: `Monthly Only ${ts}`,
        amount: 100,
        category: 'rent',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
      }
    );
    const weekly = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      {
        description: `Weekly Only ${ts}`,
        amount: 50,
        category: 'groceries',
        interval: 'weekly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
      }
    );

    await recurringExpenseService.generateInstances('weekly');

    expect(await Expense.countDocuments({ recurringExpenseId: monthly._id })).toBe(0);
    expect(await Expense.countDocuments({ recurringExpenseId: weekly._id })).toBe(1);
  });

  it('ignores inactive templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const created = await recurringExpenseService.create(
      couple._id.toString(),
      alice._id.toString(),
      {
        description: `Inactive Rent ${ts}`,
        amount: 100,
        category: 'rent',
        interval: 'monthly',
        payerMode: 'fixed',
        fixedPayerUserId: alice._id.toString(),
      }
    );
    await recurringExpenseService.deactivate(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    await recurringExpenseService.generateInstances('monthly');

    const count = await Expense.countDocuments({ recurringExpenseId: created._id });
    expect(count).toBe(0);
  });
});
