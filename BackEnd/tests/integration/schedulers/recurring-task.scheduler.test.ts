import { describe, it, expect } from 'vitest';
import { recurringTaskService } from '../../../src/services/recurring-task.service';
import { Task } from '../../../src/models/task.model';
import { FIXTURES } from '../../seed/fixtures';

function dailyPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe('recurringTaskService.generateInstances (recurring-task scheduler worker)', () => {
  it('spawns one Task per active daily template', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const title = `Auto Trash ${ts}`;

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      { title, interval: 'daily' }
    );

    await recurringTaskService.generateInstances('daily');

    const spawned = await Task.find({ recurringTaskId: created._id }).lean();
    expect(spawned).toHaveLength(1);
    // Dedup query uses createdAt (not date) — assert on the right field.
    expect(spawned[0].createdAt.getTime()).toBeGreaterThanOrEqual(dailyPeriodStart().getTime());
  });

  it('is idempotent — two calls in the same period spawn one instance', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      { title: `Idempo Trash ${ts}`, interval: 'daily' }
    );

    await recurringTaskService.generateInstances('daily');
    await recurringTaskService.generateInstances('daily');

    const count = await Task.countDocuments({ recurringTaskId: created._id });
    expect(count).toBe(1);
  });

  it('only spawns for the requested interval', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const daily = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      { title: `Daily Only ${ts}`, interval: 'daily' }
    );
    const monthly = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      { title: `Monthly Only ${ts}`, interval: 'monthly' }
    );

    await recurringTaskService.generateInstances('daily');

    expect(await Task.countDocuments({ recurringTaskId: daily._id })).toBe(1);
    expect(await Task.countDocuments({ recurringTaskId: monthly._id })).toBe(0);
  });

  it('ignores inactive templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();

    const created = await recurringTaskService.create(
      couple._id.toString(),
      alice._id.toString(),
      { title: `Inactive Trash ${ts}`, interval: 'daily' }
    );
    await recurringTaskService.deactivate(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    await recurringTaskService.generateInstances('daily');

    const count = await Task.countDocuments({ recurringTaskId: created._id });
    expect(count).toBe(0);
  });
});
