import cron from 'node-cron';
import os from 'os';
import { CronLock } from '../models/cron-lock.model';
import { logger } from '../utils/logger';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RENEW_MS = 3 * 60 * 1000;
const INSTANCE_ID = `${os.hostname()}:${process.pid}`;

interface ScheduleWithLockOptions {
  ttlMs?: number;
  renewIntervalMs?: number;
}

export function scheduleWithLock(
  cronExpression: string,
  lockName: string,
  job: () => Promise<void>,
  options?: ScheduleWithLockOptions
): void {
  cron.schedule(cronExpression, async () => {
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const renewMs = options?.renewIntervalMs ?? DEFAULT_RENEW_MS;

    if (renewMs >= ttlMs) {
      logger.error(
        { lockName, ttlMs, renewMs },
        '[Scheduler] renewIntervalMs must be less than ttlMs; skipping job'
      );
      return;
    }

    // 1. Acquire — atomic insert-or-fail.
    try {
      await CronLock.create({
        lockName,
        acquiredBy: INSTANCE_ID,
        expiresAt: new Date(Date.now() + ttlMs),
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        logger.debug({ lockName }, '[Scheduler] Lock held by another instance, skipping');
        return;
      }
      logger.error({ err, lockName }, '[Scheduler] Failed to acquire lock');
      return;
    }

    // 2. Heartbeat — extend expiresAt while job runs.
    // Filter by acquiredBy so we never accidentally extend a lock another
    // instance acquired after our doc was TTL-deleted.
    const heartbeat = setInterval(async () => {
      try {
        const result = await CronLock.updateOne(
          { lockName, acquiredBy: INSTANCE_ID },
          { $set: { expiresAt: new Date(Date.now() + ttlMs) } }
        );
        if (result.matchedCount === 0) {
          logger.warn({ lockName }, '[Scheduler] Lost lock during execution (TTL elapsed)');
          clearInterval(heartbeat);
        }
      } catch (err) {
        logger.error({ err, lockName }, '[Scheduler] Lock heartbeat failed');
      }
    }, renewMs);

    // 3. Run + always release. Filter by acquiredBy to avoid deleting another
    // instance's lock if our doc was TTL-deleted and they acquired meanwhile.
    try {
      await job();
    } catch (err) {
      logger.error({ err, lockName }, '[Scheduler] Job failed');
    } finally {
      clearInterval(heartbeat);
      try {
        await CronLock.deleteOne({ lockName, acquiredBy: INSTANCE_ID });
      } catch (err) {
        logger.error({ err, lockName }, '[Scheduler] Failed to release lock (will TTL)');
      }
    }
  });
}
