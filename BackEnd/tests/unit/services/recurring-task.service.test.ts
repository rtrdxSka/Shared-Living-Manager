import { describe, it, expect } from 'vitest';
import { recurringTaskService } from '../../../src/services/recurring-task.service';
import { RecurringTask } from '../../../src/models/recurring-task.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import type { ICreateRecurringTaskInput } from '../../../src/types/recurring-task.types';

// ── Helpers ──────────────────────────────────────────────────────────
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

const baseInput = (
  overrides: Partial<ICreateRecurringTaskInput> = {}
): ICreateRecurringTaskInput => ({
  title: 'Weekly chore template',
  interval: 'weekly',
  ...overrides,
});

// ── create ──────────────────────────────────────────────────────────

describe('recurringTaskService.create', () => {
  it('creates a recurring task for a task-participating member (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseInput({
        title: 'Recurring vacuum',
        interval: 'weekly',
      })
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.createdByUserId).toBe(alice._id.toString());
    expect(result.title).toBe('Recurring vacuum');
    expect(result.interval).toBe('weekly');
    expect(result.isActive).toBe(true);
  });

  it('rejects a non-task-participating member with Forbidden (403)', async () => {
    // Frank in flatshare has participatesInTasks: false.
    const flatshare = FIXTURES.household('flatshare');
    const frank = FIXTURES.user('frank');

    await expect(
      recurringTaskService.create(
        flatshare._id.toString(),
        frank._id.toString(),
        baseInput({ title: 'Frank attempt' })
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── list ────────────────────────────────────────────────────────────

describe('recurringTaskService.list', () => {
  it('returns active templates for a household member', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseInput({ title: 'List-test active rec-task' })
    );

    const list = await recurringTaskService.list(
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

describe('recurringTaskService.update', () => {
  it('lets the creator update title and interval', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseInput({ title: 'Update target — original', interval: 'weekly' })
    );

    const updated = await recurringTaskService.update(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { title: 'Update target — renamed', interval: 'monthly' }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.title).toBe('Update target — renamed');
    expect(updated.interval).toBe('monthly');
  });

  it('rejects a non-creator non-admin updating someone else’s template with Forbidden (403)', async () => {
    // Alice creates the template; Bob (also a member, but not the creator and
    // not an admin) attempts to update it.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseInput({ title: 'Non-creator update target' })
    );

    await expect(
      recurringTaskService.update(
        couple._id.toString(),
        bob._id.toString(),
        created._id,
        { title: 'Bob tries to edit' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('lets an admin who did not create the template update it', async () => {
    // Carol (flatshare owner) creates the template; Eve (flatshare admin)
    // updates it — admin bypass should allow.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringTaskService.create(
      flatshare._id.toString(),
      carol._id.toString(),
      baseInput({ title: 'Admin-bypass update target', interval: 'weekly' })
    );

    const updated = await recurringTaskService.update(
      flatshare._id.toString(),
      eve._id.toString(),
      created._id,
      { title: 'Admin-bypass update — renamed', interval: 'monthly' }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.title).toBe('Admin-bypass update — renamed');
    expect(updated.interval).toBe('monthly');
  });
});

// ── deactivate ──────────────────────────────────────────────────────

describe('recurringTaskService.deactivate', () => {
  it('lets the creator deactivate a template — drops out of list', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      baseInput({ title: 'To-be-deactivated rec-task' })
    );

    await expect(
      recurringTaskService.deactivate(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const list = await recurringTaskService.list(
      couple._id.toString(),
      alice._id.toString()
    );
    expect(list.find((t) => t._id === created._id)).toBeUndefined();

    const stillThere = await RecurringTask.findById(created._id).lean();
    expect(stillThere).not.toBeNull();
    expect(stillThere!.isActive).toBe(false);
  });

  it('lets an admin who did not create the template deactivate it', async () => {
    // Carol (flatshare owner) creates the template; Eve (flatshare admin)
    // deactivates it — admin bypass should allow.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringTaskService.create(
      flatshare._id.toString(),
      carol._id.toString(),
      baseInput({ title: 'Admin-bypass deactivate target' })
    );

    await expect(
      recurringTaskService.deactivate(
        flatshare._id.toString(),
        eve._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await RecurringTask.findById(created._id).lean();
    expect(stillThere).not.toBeNull();
    expect(stillThere!.isActive).toBe(false);
  });
});
