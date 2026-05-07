# Mongo-Based Distributed Cron Lock — Design Spec

**Date:** 2026-05-03
**Status:** Approved, ready for implementation plan
**Scope:** BackEnd schedulers only

---

## Context

The backend has three in-process cron schedulers started inside the same Node process at boot (`BackEnd/src/index.ts:130-132`):

| File | Cron expressions |
|---|---|
| `BackEnd/src/scheduler/pendingExpenses.ts` | Hourly (`0 * * * *`) |
| `BackEnd/src/scheduler/recurringExpenses.ts` | Monthly (`5 0 1 * *`), weekly (`3 0 * * 1`) |
| `BackEnd/src/scheduler/recurringTasks.ts` | Daily (`1 0 * * *`), weekly (`4 0 * * 1`), monthly (`6 0 1 * *`) |

Today this runs on a single backend instance and works correctly. The unique compound indexes on `Task.{recurringTaskId, dueDate}` and `Expense.{recurringExpenseId, date}` already prevent data corruption from concurrent generation — Mongo rejects the duplicate inserts (E11000).

**The problem this spec addresses** is that the schedulers cannot be safely scaled to multiple backend instances. Without coordination:
- Every instance fires every cron tick simultaneously, multiplying DB load by N.
- Logs fill with E11000 duplicate-key errors at scheduled minutes.
- Any future non-idempotent side effect added to a job (e.g., sending a notification email when expenses generate) would fire N times instead of once.

Adding a lightweight Mongo-based distributed lock is a prerequisite for safe horizontal scaling. This spec is a small, self-contained piece of infrastructure that costs ~negligible CPU/DB on a single instance and unlocks multi-instance deployment when the rest of the horizontal-scaling work happens.

## Goals

1. Ensure that for every scheduled cron tick, **at most one backend instance** runs the job body.
2. Survive instance crashes — a crashed instance must not block the next legitimate cron run indefinitely.
3. Survive jobs running longer than the lock's nominal TTL (lock renewal heartbeat).
4. Zero new infrastructure dependencies — uses the existing MongoDB connection.
5. Minimal invasion at call sites — schedulers swap `cron.schedule(...)` for `scheduleWithLock(...)` with no other change.

## Non-goals

- Replacing `node-cron`. We continue to use it for the cron expression parser and timer; the lock layers on top.
- Running schedulers in a separate worker process.
- Bull / BullMQ / a real job queue (would solve a superset of these problems but requires Redis and an architectural rewrite — out of proportion to the 6 cron handlers we have).
- Cancelling a job mid-execution if the lock is lost (would require every job function to be AbortSignal-aware — large refactor).
- Automated unit/integration tests (project has no test framework configured; adding one is its own multi-day project).

## Architecture

### Files to add

| Path | Purpose |
|---|---|
| `BackEnd/src/models/cron-lock.model.ts` | Mongoose model for the `cronLocks` collection: unique index on `lockName`, TTL index on `expiresAt` |
| `BackEnd/src/scheduler/cronLock.ts` | Exports `scheduleWithLock(cronExpression, lockName, job, options?)` |

### Files to modify

| Path | Change |
|---|---|
| `BackEnd/src/scheduler/pendingExpenses.ts` | Replace 1 `cron.schedule(...)` with `scheduleWithLock(...)` |
| `BackEnd/src/scheduler/recurringExpenses.ts` | Replace 2 `cron.schedule(...)` calls |
| `BackEnd/src/scheduler/recurringTasks.ts` | Replace 3 `cron.schedule(...)` calls |

No changes to `BackEnd/src/index.ts` — the existing `startRecurringScheduler()`, `startRecurringTaskScheduler()`, `startPendingExpenseScheduler()` calls stay as-is. Only the internals of those functions change.

## Schema

```ts
// BackEnd/src/models/cron-lock.model.ts
import mongoose, { Schema } from 'mongoose';

interface ICronLock {
  lockName: string;
  acquiredAt: Date;
  expiresAt: Date;
  acquiredBy: string;  // hostname:pid for debugging
}

const cronLockSchema = new Schema<ICronLock>(
  {
    lockName:   { type: String, required: true, unique: true },
    acquiredAt: { type: Date,   required: true, default: () => new Date() },
    expiresAt:  { type: Date,   required: true },
    acquiredBy: { type: String, required: true },
  },
  { collection: 'cronLocks' }
);

cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CronLock = mongoose.model<ICronLock>('CronLock', cronLockSchema);
```

**Index notes:**
- `unique: true` on `lockName` automatically creates the unique index that gives us atomic `insertOne` semantics (the second insert with the same `lockName` throws E11000).
- The TTL index uses `expireAfterSeconds: 0`, which makes Mongo delete documents when their `expiresAt` field is in the past. Mongo's TTL monitor runs every ~60 seconds, so cleanup may lag the actual expiry by up to a minute. This is documented Mongo behavior and acceptable for our use case.

## Helper API

```ts
// BackEnd/src/scheduler/cronLock.ts
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

    // 1. Acquire
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

    // 2. Heartbeat — extend expiresAt while the job runs
    const heartbeat = setInterval(async () => {
      try {
        const result = await CronLock.updateOne(
          { lockName, acquiredBy: INSTANCE_ID },
          { $set: { expiresAt: new Date(Date.now() + ttlMs) } }
        );
        if (result.matchedCount === 0) {
          logger.warn({ lockName }, '[Scheduler] Lost lock during execution (TTL elapsed)');
        }
      } catch (err) {
        logger.error({ err, lockName }, '[Scheduler] Lock heartbeat failed');
      }
    }, renewMs);

    // 3. Run + always release
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
```

### Why `acquiredBy` filters everything

Both the heartbeat update and the release delete include `acquiredBy: INSTANCE_ID` in their filter. This is a critical correctness detail.

Race scenario without the filter:
1. T=0 — Instance A acquires the lock with `expiresAt = T+10min`.
2. A's job hangs. The heartbeat also fails (e.g., Mongo network blip).
3. T=10min+1min — Mongo TTL deletes the lock document.
4. T=11min — Instance B's cron tick fires, successfully creates a new lock document (different `acquiredBy`).
5. T=12min — A finally finishes its job and runs `deleteOne({ lockName })`. **Without the `acquiredBy` filter, A would delete B's active lock.**

With the filter, A's delete matches no documents and is a no-op. B's lock stays intact. The same logic protects the heartbeat — A's renewal cannot accidentally extend B's lock.

### What we accept (and why)

The filter prevents lock-stealing but does not prevent **brief concurrent execution** in the catastrophic-case scenario above (A and B both running between T=11min and T=12min). The cost of fully preventing this would be making every job function AbortSignal-aware so we could cancel A when its heartbeat fails. That is a much larger refactor than the lock itself, and the unique indexes on `Task` and `Expense` already prevent data corruption from concurrent generation. The `[Scheduler] Lost lock during execution` warning is the operator's signal that Mongo connectivity is unhealthy.

For thesis-scale jobs (every job currently completes in well under 1 second), the heartbeat will almost never fire. The renewal is defense for unlikely future scenarios where a dataset grows large or a Mongo write stalls.

## Lock-name registry

Stable, human-readable names — not per-tick. The 10-minute TTL is much shorter than the shortest run interval (1 hour), so reuse is safe and the TTL collection stays tiny.

| Scheduler call site | Lock name |
|---|---|
| `pendingExpenses.ts` hourly | `pending-expenses-auto-confirm` |
| `recurringExpenses.ts` monthly | `recurring-expenses-monthly` |
| `recurringExpenses.ts` weekly | `recurring-expenses-weekly` |
| `recurringTasks.ts` daily | `recurring-tasks-daily` |
| `recurringTasks.ts` weekly | `recurring-tasks-weekly` |
| `recurringTasks.ts` monthly | `recurring-tasks-monthly` |

## Error-handling table

| Failure mode | Behavior |
|---|---|
| Acquire fails with E11000 (lock held) | Silent skip, `logger.debug` — expected and benign |
| Acquire fails with other error | `logger.error`, skip this tick — do not crash the cron timer |
| Heartbeat update fails (Mongo error) | `logger.error`, job continues — best-effort |
| Heartbeat returns matchedCount=0 (lock TTL'd while we held it) | `logger.warn`, job continues — operator alert |
| Job throws | `logger.error`, lock is still released in `finally` |
| Release fails | `logger.error`, lock will TTL-expire within ~11 min |

## Verification plan

1. **Type-check**: `cd BackEnd && npm run build` — confirm TypeScript compiles cleanly with no errors.
2. **Boot smoke test**: `docker compose up backend mongodb` (or `npm run dev` in `BackEnd/`). Confirm the three "[Scheduler] ... started" log lines appear and no error logs follow on startup.
3. **Index inspection**: in `mongosh` against the running database, run `db.cronLocks.getIndexes()`. Confirm two indexes exist beyond `_id_`:
   - `{ key: { lockName: 1 }, name: "lockName_1", unique: true }`
   - `{ key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 }`
4. **Acquire/release round-trip** (recommended): manually trigger one of the schedulers (e.g., temporarily change `pendingExpenses.ts` to fire `*/10 * * * * *` for one boot). In `mongosh`, run `db.cronLocks.find()` repeatedly — confirm a doc appears at the start of each tick and disappears at the end. Revert the cron expression after.
5. **Renewal smoke test** (optional, manual): temporarily set `DEFAULT_TTL_MS=30_000` and `DEFAULT_RENEW_MS=10_000`, and instrument one job to `await new Promise(r => setTimeout(r, 60_000))`. Boot and watch the lock doc's `expiresAt` field advance every ~10 seconds while the job runs, then disappear when the job completes. Revert all three changes.
6. **Race smoke test** (optional, only meaningful if planning multi-instance): boot two backend instances on different ports against the same MongoDB. Watch the log lines on both — only one should log job-completion messages per scheduled tick. The other should log nothing or the debug-level "Lock held" message.

Steps 1-3 are required. Steps 4-6 are recommended for confidence but not blocking.

## Effective behavior

| Deployment | Per-tick cost | User-visible behavior |
|---|---|---|
| 1 backend instance (today) | +1 insert, +1 delete per cron tick (~2-5 ms total Mongo work) | Identical to current behavior |
| 2+ backend instances (future) | Each tick: only one instance does the work; others do +1 failed insert each (~1 ms) | Schedulers run exactly once per scheduled tick across the cluster, regardless of replica count |

## Out of scope (deliberately)

- **Bull / BullMQ.** Would solve a superset of these problems and add retries, dead-letter queues, observability — but requires Redis and rewrites all three schedulers. Massive overkill for 6 hourly-or-less-frequent handlers. Right answer if the project later adds many async background jobs.
- **AbortController-based mid-flight job cancellation when the lock is lost.** Would require every job function to be cancellation-aware. Big refactor for a thin slice of additional safety; unique indexes on Task and Expense already prevent the data-corruption case.
- **Metrics / observability hooks** (Prometheus counter for lock acquisitions, etc.). Useful in production at scale, gold-plating for a thesis.
- **Automated tests.** No test framework configured. Adding one is a separate, larger project.
- **Wrapping non-cron operations.** This helper is for cron only. Route handlers and service methods do not need a lock.
