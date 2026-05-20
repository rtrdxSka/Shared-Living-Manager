# Mongo-Based Cron Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mongo-based distributed cron lock with TTL-renewal heartbeat so that the three in-process schedulers (pendingExpenses, recurringExpenses, recurringTasks) are safe under multi-instance deployment without changing single-instance behavior.

**Architecture:** A new `cronLocks` Mongo collection with a unique index on `lockName` and a TTL index on `expiresAt`. A small helper `scheduleWithLock(cronExpression, lockName, job, options?)` wraps `node-cron` — it tries to atomically `insertOne` the lock doc, runs the job if it acquired, periodically extends `expiresAt` while running, and deletes the doc when done. All three scheduler files swap their `cron.schedule(...)` calls to `scheduleWithLock(...)`.

**Tech Stack:** Node 20 / TypeScript / Express / Mongoose 9 / node-cron / pino logger. Project convention: model interfaces live in `BackEnd/src/types/<name>.types.ts`, models in `BackEnd/src/models/<name>.model.ts`.

**Note on testing:** This project has no test framework configured — `BackEnd/package.json` has the placeholder `"test": "echo \"Error: no test specified\" && exit 1"`. The approved spec explicitly defers adding one as out of scope. Each task therefore uses `npm run build` (TypeScript type-check) as the per-step verification gate, with a final manual end-to-end smoke test in Task 7. This deviates from the writing-plans skill's TDD default, but matches the user-approved spec. If the engineer disagrees, raise it before starting Task 1 — don't add a test framework silently.

**Spec reference:** `docs/superpowers/specs/2026-05-03-mongo-cron-lock-design.md`

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `BackEnd/src/types/cron-lock.types.ts` | NEW | The `ICronLock` interface |
| `BackEnd/src/models/cron-lock.model.ts` | NEW | Mongoose model + unique/TTL indexes |
| `BackEnd/src/scheduler/cronLock.ts` | NEW | `scheduleWithLock` helper, heartbeat, instance ID |
| `BackEnd/src/scheduler/pendingExpenses.ts` | MODIFIED | Uses `scheduleWithLock` |
| `BackEnd/src/scheduler/recurringExpenses.ts` | MODIFIED | Uses `scheduleWithLock` (2 sites) |
| `BackEnd/src/scheduler/recurringTasks.ts` | MODIFIED | Uses `scheduleWithLock` (3 sites) |

No changes to `BackEnd/src/index.ts`. No changes to any service. No changes to any other model.

---

## Task 1: Define the `ICronLock` interface

**Files:**
- Create: `BackEnd/src/types/cron-lock.types.ts`

- [ ] **Step 1: Create the type file**

Write `BackEnd/src/types/cron-lock.types.ts`:

```ts
import { Document, Types } from 'mongoose';

export interface ICronLock extends Document {
  _id: Types.ObjectId;
  lockName: string;
  acquiredAt: Date;
  expiresAt: Date;
  acquiredBy: string;
}
```

- [ ] **Step 2: Verify build passes**

Run from repo root:
```bash
cd BackEnd && npm run build
```
Expected output: TypeScript compiles silently with no errors. Stdout shows the npm preamble and `> tsc` only.

- [ ] **Step 3: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/types/cron-lock.types.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): add ICronLock type

Foundation for the upcoming Mongo-based distributed cron lock.
EOF
)"
```

---

## Task 2: Create the `CronLock` Mongoose model

**Files:**
- Create: `BackEnd/src/models/cron-lock.model.ts`

- [ ] **Step 1: Create the model file**

Write `BackEnd/src/models/cron-lock.model.ts`:

```ts
import mongoose, { Schema } from 'mongoose';
import { ICronLock } from '../types/cron-lock.types';

const cronLockSchema = new Schema<ICronLock>(
  {
    lockName: {
      type: String,
      required: true,
      unique: true,
    },
    acquiredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acquiredBy: {
      type: String,
      required: true,
    },
  },
  { collection: 'cronLocks' }
);

// TTL index: Mongo deletes documents when expiresAt < now.
// The TTL monitor runs ~every 60s, so cleanup may lag by up to a minute.
cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CronLock = mongoose.model<ICronLock>('CronLock', cronLockSchema);
```

- [ ] **Step 2: Verify build passes**

Run:
```bash
cd BackEnd && npm run build
```
Expected: TypeScript compiles silently.

- [ ] **Step 3: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/models/cron-lock.model.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): add CronLock model with unique + TTL indexes

Defines the cronLocks collection. The unique index on lockName gives
us atomic insert-or-fail semantics for lock acquisition. The TTL index
on expiresAt auto-releases locks held by crashed instances.
EOF
)"
```

---

## Task 3: Implement the `scheduleWithLock` helper

**Files:**
- Create: `BackEnd/src/scheduler/cronLock.ts`

- [ ] **Step 1: Create the helper file**

Write `BackEnd/src/scheduler/cronLock.ts`:

```ts
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
```

- [ ] **Step 2: Verify build passes**

Run:
```bash
cd BackEnd && npm run build
```
Expected: TypeScript compiles silently. If you see "Cannot find name 'os'" or similar, double-check the imports — the codebase does NOT use `node:` prefixes for built-ins.

- [ ] **Step 3: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/scheduler/cronLock.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): add scheduleWithLock helper

Wraps node-cron with atomic Mongo-based lock acquisition. Includes
a 3-minute heartbeat that extends expiresAt while a job runs, and
acquiredBy filtering on both renewal and release to prevent stealing
another instance's lock after our own was TTL-expired.
EOF
)"
```

---

## Task 4: Migrate `pendingExpenses.ts` to use `scheduleWithLock`

**Files:**
- Modify: `BackEnd/src/scheduler/pendingExpenses.ts`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat BackEnd/src/scheduler/pendingExpenses.ts
```

You should see one `cron.schedule('0 * * * *', ...)` block calling `expenseService.autoConfirmExpiredPending()`.

- [ ] **Step 2: Replace the file**

Overwrite `BackEnd/src/scheduler/pendingExpenses.ts` with:

```ts
import { expenseService } from '../services/expense.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startPendingExpenseScheduler(): void {
  // Run every hour — auto-confirm pending resolutions older than 48 hours
  scheduleWithLock(
    '0 * * * *',
    'pending-expenses-auto-confirm',
    async () => {
      logger.info('[Scheduler] Auto-confirming expired pending expense resolutions...');
      const count = await expenseService.autoConfirmExpiredPending();
      if (count > 0) {
        logger.info(`[Scheduler] Auto-confirmed ${count} pending expense(s)`);
      }
    }
  );

  logger.info('[Scheduler] Pending expense scheduler started');
}
```

Note: `import cron from 'node-cron'` has been removed because we no longer reference `cron` directly. The previous `.then(...).catch(...)` chain is replaced by an `async`/`await` body — `scheduleWithLock` already logs job errors via `logger.error`.

- [ ] **Step 3: Verify build passes**

Run:
```bash
cd BackEnd && npm run build
```
Expected: TypeScript compiles silently. If you see "noUnusedLocals" or "noUnusedParameters" errors, you've left a stale import — fix and rebuild.

- [ ] **Step 4: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/scheduler/pendingExpenses.ts
git commit -m "$(cat <<'EOF'
refactor(scheduler): migrate pendingExpenses to scheduleWithLock

Wraps the hourly auto-confirm cron with the new distributed lock so
the job runs at most once per tick across multiple backend instances.
No behavior change on a single-instance deployment.
EOF
)"
```

---

## Task 5: Migrate `recurringExpenses.ts` to use `scheduleWithLock`

**Files:**
- Modify: `BackEnd/src/scheduler/recurringExpenses.ts`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat BackEnd/src/scheduler/recurringExpenses.ts
```

You should see two `cron.schedule(...)` blocks: monthly (`5 0 1 * *`) and weekly (`3 0 * * 1`), both calling `recurringExpenseService.generateInstances(...)`.

- [ ] **Step 2: Replace the file**

Overwrite `BackEnd/src/scheduler/recurringExpenses.ts` with:

```ts
import { recurringExpenseService } from '../services/recurring-expense.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startRecurringScheduler(): void {
  // Run at 00:05 on the 1st of every month — generate monthly instances
  // (staggered from other midnight jobs to avoid DB thundering herd)
  scheduleWithLock(
    '5 0 1 * *',
    'recurring-expenses-monthly',
    async () => {
      logger.info('[Scheduler] Generating monthly recurring expenses...');
      await recurringExpenseService.generateInstances('monthly');
    }
  );

  // Run at 00:03 every Monday — generate weekly instances
  scheduleWithLock(
    '3 0 * * 1',
    'recurring-expenses-weekly',
    async () => {
      logger.info('[Scheduler] Generating weekly recurring expenses...');
      await recurringExpenseService.generateInstances('weekly');
    }
  );

  logger.info('[Scheduler] Recurring expense scheduler started');
}
```

- [ ] **Step 3: Verify build passes**

Run:
```bash
cd BackEnd && npm run build
```
Expected: TypeScript compiles silently.

- [ ] **Step 4: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/scheduler/recurringExpenses.ts
git commit -m "$(cat <<'EOF'
refactor(scheduler): migrate recurringExpenses to scheduleWithLock

Both the monthly and weekly recurring-expense generators now run
under stable per-job lock names. Existing unique compound index on
{recurringExpenseId, date} continues to be the data-correctness
backstop; the lock eliminates wasted concurrent work.
EOF
)"
```

---

## Task 6: Migrate `recurringTasks.ts` to use `scheduleWithLock`

**Files:**
- Modify: `BackEnd/src/scheduler/recurringTasks.ts`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat BackEnd/src/scheduler/recurringTasks.ts
```

You should see three `cron.schedule(...)` blocks: monthly (`6 0 1 * *`), weekly (`4 0 * * 1`), and daily (`1 0 * * *`).

- [ ] **Step 2: Replace the file**

Overwrite `BackEnd/src/scheduler/recurringTasks.ts` with:

```ts
import { recurringTaskService } from '../services/recurring-task.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startRecurringTaskScheduler(): void {
  // Run at 00:06 on the 1st of every month — generate monthly instances
  // (staggered after the expense monthly job to avoid midnight thundering herd)
  scheduleWithLock(
    '6 0 1 * *',
    'recurring-tasks-monthly',
    async () => {
      logger.info('[Scheduler] Generating monthly recurring tasks...');
      await recurringTaskService.generateInstances('monthly');
    }
  );

  // Run at 00:04 every Monday — generate weekly instances
  scheduleWithLock(
    '4 0 * * 1',
    'recurring-tasks-weekly',
    async () => {
      logger.info('[Scheduler] Generating weekly recurring tasks...');
      await recurringTaskService.generateInstances('weekly');
    }
  );

  // Run at 00:01 every day — generate daily instances
  scheduleWithLock(
    '1 0 * * *',
    'recurring-tasks-daily',
    async () => {
      logger.info('[Scheduler] Generating daily recurring tasks...');
      await recurringTaskService.generateInstances('daily');
    }
  );

  logger.info('[Scheduler] Recurring task scheduler started');
}
```

- [ ] **Step 3: Verify build passes**

Run:
```bash
cd BackEnd && npm run build
```
Expected: TypeScript compiles silently.

- [ ] **Step 4: Commit**

```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git add BackEnd/src/scheduler/recurringTasks.ts
git commit -m "$(cat <<'EOF'
refactor(scheduler): migrate recurringTasks to scheduleWithLock

All three recurring-task generators (daily/weekly/monthly) now run
under stable per-job lock names. Existing unique compound index on
{recurringTaskId, dueDate} continues to be the data-correctness
backstop.
EOF
)"
```

---

## Task 7: End-to-end boot smoke test + index verification

**Files:** none modified — verification only.

This task confirms the full system starts cleanly and the indexes Mongo expects are actually created. **Do not commit anything in this task** — there's nothing to commit.

- [ ] **Step 1: Boot the backend + Mongo**

Choose one of:

**Option A (Docker-based, matches production-style):**
```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
docker compose up backend mongodb
```

**Option B (local dev, faster to iterate):**
```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager/BackEnd
npm run dev
```
(Requires a Mongo instance reachable at the URL in `.env`.)

Watch the logs. You should see, in order:

```
✅ MongoDB connected successfully
[Scheduler] Pending expense scheduler started
[Scheduler] Recurring expense scheduler started
[Scheduler] Recurring task scheduler started
🚀 Server running on port 5000
```

If any `[Scheduler] Failed to acquire lock` or `[Scheduler] Job failed` errors appear at startup, stop and investigate before proceeding — startup should be clean.

- [ ] **Step 2: Inspect the cronLocks indexes**

In a separate terminal, connect to the running Mongo:

```bash
# If using docker compose:
docker compose exec mongodb mongosh \
  --authenticationDatabase admin -u admin -p admin123 \
  shared_living
# Or if Mongo is local: mongosh shared_living
```

Run:
```javascript
db.cronLocks.getIndexes()
```

You should see exactly three indexes:

```json
[
  { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
  {
    "v": 2,
    "key": { "lockName": 1 },
    "name": "lockName_1",
    "unique": true
  },
  {
    "v": 2,
    "key": { "expiresAt": 1 },
    "name": "expiresAt_1",
    "expireAfterSeconds": 0
  }
]
```

If `lockName_1` is missing the `unique: true` flag, or `expiresAt_1` is missing the `expireAfterSeconds: 0` flag — the model is wrong. Drop the collection (`db.cronLocks.drop()`) and restart the backend so Mongoose recreates the indexes.

- [ ] **Step 3: Optional — quick acquire/release round-trip**

Still in `mongosh`:
```javascript
db.cronLocks.find()
```

Outside cron-tick windows this should return 0 documents (locks only exist while a job runs, and your jobs run in well under a second). To force a visible lock, you can wait until top-of-hour for `pending-expenses-auto-confirm` to fire, then run the find quickly.

A more practical check: temporarily change one cron expression to `*/10 * * * * *` (every 10 seconds) in `pendingExpenses.ts`, restart, and watch the find: a doc appears at every 10-second tick and disappears within a second. Revert the cron expression and restart before proceeding.

- [ ] **Step 4: Stop the backend**

Stop the dev server / `docker compose down`.

- [ ] **Step 5: Verify the working tree is clean**

Run:
```bash
cd /home/mitev_kristian/MastersProject/Shared-Living-Manager
git status
```

Expected: `working tree clean` — all 6 commits from Tasks 1-6 are already in. No leftover modifications from the smoke test (you reverted any temporary cron-expression changes in Step 3).

---

## Self-Review Notes

After writing the plan, I checked it against the spec:

| Spec section | Plan task |
|---|---|
| Schema (`ICronLock`, indexes) | Tasks 1 + 2 |
| Helper API (`scheduleWithLock`, options, defaults) | Task 3 |
| Heartbeat / `acquiredBy` filter rationale | Task 3 inline comments |
| Lock-name registry (6 names) | Tasks 4-6 |
| Error handling (E11000, throws, release fail) | Task 3 helper body |
| Verification plan (build, boot, indexes) | Tasks 1-6 build steps + Task 7 |

Out-of-scope items (Bull/BullMQ, AbortController cancellation, metrics, automated tests) are correctly absent.

No placeholders, no "TBD", no "implement appropriate error handling" — every step shows the actual code or the actual command.

Type / signature consistency check: `scheduleWithLock(cronExpression: string, lockName: string, job: () => Promise<void>, options?: ScheduleWithLockOptions)` — same signature used in Tasks 4, 5, 6 call sites. `INSTANCE_ID`, `DEFAULT_TTL_MS`, `DEFAULT_RENEW_MS` only referenced inside `cronLock.ts`. `CronLock` model only referenced inside `cronLock.ts`. Clean.
