import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronLock } from '../../../src/models/cron-lock.model';

// Capture the handler scheduleWithLock passes to cron.schedule so tests can fire it directly.
let capturedHandler: () => Promise<void>;

vi.mock('node-cron', () => {
  const schedule = (_expr: string, handler: () => Promise<void>) => {
    capturedHandler = handler;
    return { stop: vi.fn(), start: vi.fn() };
  };
  return {
    default: { schedule },
    schedule,
  };
});

// Import AFTER vi.mock so cronLock.ts picks up the mocked node-cron.
import { scheduleWithLock } from '../../../src/scheduler/cronLock';

describe('scheduleWithLock', () => {
  beforeEach(async () => {
    await CronLock.deleteMany({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first instance acquires the lock, runs the job, and releases the lock', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    scheduleWithLock('* * * * *', 'lock-A', job, { ttlMs: 60_000, renewIntervalMs: 1_000 });

    await capturedHandler();

    expect(job).toHaveBeenCalledOnce();
    const remaining = await CronLock.findOne({ lockName: 'lock-A' });
    expect(remaining).toBeNull();
  });

  it('skips the job when the lock is already held by another instance', async () => {
    await CronLock.create({
      lockName: 'lock-B',
      acquiredBy: 'other-instance:1',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const job = vi.fn().mockResolvedValue(undefined);
    scheduleWithLock('* * * * *', 'lock-B', job, { ttlMs: 60_000, renewIntervalMs: 1_000 });

    await capturedHandler();

    expect(job).not.toHaveBeenCalled();
    const stillHeld = await CronLock.findOne({ lockName: 'lock-B' });
    expect(stillHeld?.acquiredBy).toBe('other-instance:1');
  });

  it('extends expiresAt while the job runs (heartbeat)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let release!: () => void;
    const job = vi.fn(() => new Promise<void>((r) => { release = r; }));

    scheduleWithLock('* * * * *', 'lock-C', job, { ttlMs: 60_000, renewIntervalMs: 1_000 });
    const handlerPromise = capturedHandler();

    await vi.waitFor(async () => {
      const lock = await CronLock.findOne({ lockName: 'lock-C' });
      expect(lock).not.toBeNull();
    });

    const before = (await CronLock.findOne({ lockName: 'lock-C' }))!.expiresAt.getTime();

    // Advance past one heartbeat tick.
    vi.advanceTimersByTime(2_000);

    await vi.waitFor(async () => {
      const after = (await CronLock.findOne({ lockName: 'lock-C' }))!.expiresAt.getTime();
      // Strict assertion. If this flakes on slow CI, downgrade to .toBeGreaterThanOrEqual(before).
      expect(after).toBeGreaterThan(before);
    });

    release();
    await handlerPromise;
  });

  it('releases the lock after the job completes successfully', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    scheduleWithLock('* * * * *', 'lock-D', job, { ttlMs: 60_000, renewIntervalMs: 1_000 });

    await capturedHandler();

    expect(await CronLock.findOne({ lockName: 'lock-D' })).toBeNull();
  });

  it('releases the lock even when the job throws', async () => {
    const job = vi.fn().mockRejectedValue(new Error('boom'));
    scheduleWithLock('* * * * *', 'lock-E', job, { ttlMs: 60_000, renewIntervalMs: 1_000 });

    await capturedHandler();

    expect(job).toHaveBeenCalledOnce();
    expect(await CronLock.findOne({ lockName: 'lock-E' })).toBeNull();
  });

  it('skips and does not create a lock when renewIntervalMs >= ttlMs', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    scheduleWithLock('* * * * *', 'lock-F', job, { ttlMs: 1_000, renewIntervalMs: 1_000 });

    await capturedHandler();

    expect(job).not.toHaveBeenCalled();
    expect(await CronLock.findOne({ lockName: 'lock-F' })).toBeNull();
  });

  it('CronLock model has TTL index with expireAfterSeconds: 0', () => {
    const indexes = CronLock.schema.indexes();
    const ttlIndex = indexes.find(([fields]) => 'expiresAt' in fields);
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex![1]).toMatchObject({ expireAfterSeconds: 0 });
  });
});
