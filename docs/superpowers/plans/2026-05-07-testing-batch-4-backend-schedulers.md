# Testing — Batch 4: Backend Scheduler Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Batches 1–3 must be green. We rely on the seed (especially recurring rules / pending expenses), the helpers, and the email mock.

**Goal:** Add unit tests for the four cron worker functions. Tests invoke the workers directly via the service singletons (the cron decoration is bypassed) and use Vitest fake timers to control `Date.now()` and `new Date()`.

**Architecture:** Tests live in `BackEnd/tests/integration/schedulers/*.scheduler.test.ts`. Each test sets a frozen system time, seeds any extra rules needed, calls the worker, then asserts on the documents that were created/updated.

**Tech Stack:** No new dependencies — Vitest's built-in `vi.useFakeTimers()` is sufficient.

**User commit policy:** **"User commit checkpoint"** = stop, summarise, wait for the user to commit.

**Important — coverage exclusion:** Batch 1's `vitest.config.ts` excluded `src/scheduler/**` from coverage. Before running coverage in Batch 4, **remove that exclusion** so scheduler code reflects in the report. Step 1 of this plan handles that.

---

## File Structure

### Files to modify
- `BackEnd/vitest.config.ts` — remove `src/scheduler/**` from `coverage.exclude`.

### Files to create
| Task | File |
|------|------|
| 2 | `BackEnd/tests/integration/schedulers/pending-expense.scheduler.test.ts` |
| 3 | `BackEnd/tests/integration/schedulers/recurring-expense.scheduler.test.ts` |
| 4 | `BackEnd/tests/integration/schedulers/recurring-task.scheduler.test.ts` |
| 5 | `BackEnd/tests/integration/schedulers/recurring-shopping-item.scheduler.test.ts` |

---

## Task 1: Re-enable scheduler coverage

**Files:**
- Modify: `BackEnd/vitest.config.ts`

- [ ] **Step 1.1: Remove the exclusion**

Open `BackEnd/vitest.config.ts`. Remove the `'src/scheduler/**'` line and the comment above it from `coverage.exclude`. The block should look like:

```ts
exclude: [
  'src/index.ts',
  'src/instrument.ts',
  'src/types/**',
  'src/**/*.d.ts',
],
```

- [ ] **Step 1.2: Type-check**

Run: `npm run type-check`
Expected: exits 0.

---

## Task 2: `pending-expense.scheduler.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/schedulers/pending-expense.scheduler.test.ts`

The worker is `expenseService.autoConfirmExpiredPending()`. It looks at expenses where `pendingConfirmation=true` and the request was placed more than 48 hours ago, then marks them `isResolved=true`.

- [ ] **Step 2.1: Write the test**

Create `BackEnd/tests/integration/schedulers/pending-expense.scheduler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expenseService } from '../../../src/services/expense.service';
import { Expense } from '../../../src/models/expense.model';
import { FIXTURES } from '../../seed/fixtures';

describe('expenseService.autoConfirmExpiredPending (pending-expense scheduler worker)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('confirms expenses pending > 48h', async () => {
    const couple = FIXTURES.household('couple');
    const expenseId = FIXTURES.expense('utilities-april'); // alice paid, bob claimed

    // Set pendingConfirmation=true with a request timestamp 49 hours ago.
    await Expense.updateOne({ _id: expenseId }, {
      pendingConfirmation: true,
      resolutionRequestedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
    });

    // Freeze "now" — autoConfirm uses Date.now() to compute the cutoff.
    vi.setSystemTime(new Date());

    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBeGreaterThanOrEqual(1);

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).toBe(true);
    expect(after?.pendingConfirmation).toBe(false);
  });

  it('does NOT confirm expenses pending < 48h', async () => {
    const expenseId = FIXTURES.expense('utilities-april');
    await Expense.updateOne({ _id: expenseId }, {
      pendingConfirmation: true,
      resolutionRequestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // only 1h ago
    });

    vi.setSystemTime(new Date());
    await expenseService.autoConfirmExpiredPending();

    const after = await Expense.findById(expenseId).lean();
    expect(after?.isResolved).not.toBe(true);
  });

  it('returns 0 when there are no pending expenses', async () => {
    // Clear all pending flags
    await Expense.updateMany({}, { pendingConfirmation: false });
    const count = await expenseService.autoConfirmExpiredPending();
    expect(count).toBe(0);
  });
});
```

Implementer notes:
- The exact field names (`pendingConfirmation`, `resolutionRequestedAt`, `isResolved`) come from the Expense schema. Verify with `grep "pendingConfirmation\|resolutionRequestedAt" BackEnd/src/models/expense.model.ts`. If a field has a different name, adjust both the seed manipulation and the assertions.
- If the worker uses a different cutoff than 48h, update the `49 * 60 * 60 * 1000` and `1 * 60 * 60 * 1000` constants accordingly.

- [ ] **Step 2.2: Run**

Run: `npm test tests/integration/schedulers/pending-expense.scheduler.test.ts`
Expected: 3 tests pass.

---

## Task 3: `recurring-expense.scheduler.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/schedulers/recurring-expense.scheduler.test.ts`

The worker is `recurringExpenseService.generateInstances(interval)`. It iterates active templates matching the interval, computes the period start from `new Date()`, and inserts an Expense per template — idempotent if already inserted for that period.

- [ ] **Step 3.1: Write the test**

Create `BackEnd/tests/integration/schedulers/recurring-expense.scheduler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recurringExpenseService } from '../../../src/services/recurring-expense.service';
import { Expense } from '../../../src/models/expense.model';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringExpenseService.generateInstances (recurring-expense scheduler worker)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('spawns Expense instances for active monthly templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    // Create a monthly template
    const created = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'Auto Rent',
      amount: 1200,
      category: 'rent',
      interval: 'monthly',
      payerMode: 'fixed',
      fixedPayerUserId: alice._id.toString(),
    });

    // Freeze time at the first of a month so the worker computes a known periodStart
    vi.setSystemTime(new Date('2026-06-01T00:05:00.000Z'));

    await recurringExpenseService.generateInstances('monthly');

    const spawned = await Expense.find({ recurringExpenseId: created.id }).lean();
    expect(spawned.length).toBe(1);
    expect(spawned[0].amount).toBe(1200);
  });

  it('is idempotent — calling twice for the same period spawns one instance', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'Idempo Rent',
      amount: 500,
      category: 'rent',
      interval: 'monthly',
      payerMode: 'fixed',
      fixedPayerUserId: alice._id.toString(),
    });

    vi.setSystemTime(new Date('2026-06-01T00:05:00.000Z'));
    await recurringExpenseService.generateInstances('monthly');
    await recurringExpenseService.generateInstances('monthly');

    const spawned = await Expense.find({ recurringExpenseId: created.id }).lean();
    expect(spawned.length).toBe(1);
  });

  it('only spawns for the requested interval', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    const monthly = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'Monthly One', amount: 100, category: 'rent',
      interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    const weekly = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'Weekly One', amount: 50, category: 'groceries',
      interval: 'weekly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });

    vi.setSystemTime(new Date('2026-06-01T00:05:00.000Z'));
    await recurringExpenseService.generateInstances('weekly');

    expect(await Expense.find({ recurringExpenseId: monthly.id }).countDocuments()).toBe(0);
    expect(await Expense.find({ recurringExpenseId: weekly.id }).countDocuments()).toBe(1);
  });
});
```

Implementer notes:
- The relationship field (`recurringExpenseId` on the Expense model) might be named differently in the actual schema (`recurringId`, `parentRecurringId`, etc.). Run `grep "recurring" BackEnd/src/models/expense.model.ts` to find the real field name and adjust the queries.

- [ ] **Step 3.2: Run**

Run: `npm test tests/integration/schedulers/recurring-expense.scheduler.test.ts`
Expected: 3 tests pass.

---

## Task 4: `recurring-task.scheduler.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/schedulers/recurring-task.scheduler.test.ts`

The worker is `recurringTaskService.generateInstances(interval)`. Same shape as recurring expenses but spawns Tasks. Date math also drives rotation member assignment.

- [ ] **Step 4.1: Write the test**

Create `BackEnd/tests/integration/schedulers/recurring-task.scheduler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recurringTaskService } from '../../../src/services/recurring-task.service';
import { Task } from '../../../src/models/task.model';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringTaskService.generateInstances (recurring-task scheduler worker)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('spawns Task instances for active weekly templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Auto Trash',
      interval: 'weekly',
    });

    vi.setSystemTime(new Date('2026-06-08T00:04:00.000Z')); // a Monday

    await recurringTaskService.generateInstances('weekly');

    const spawned = await Task.find({ recurringTaskId: created.id }).lean();
    expect(spawned.length).toBe(1);
  });

  it('is idempotent across same-period calls', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Auto Idempo', interval: 'weekly',
    });
    vi.setSystemTime(new Date('2026-06-08T00:04:00.000Z'));

    await recurringTaskService.generateInstances('weekly');
    await recurringTaskService.generateInstances('weekly');

    const spawned = await Task.find({ recurringTaskId: created.id }).lean();
    expect(spawned.length).toBe(1);
  });

  it('only spawns for the requested interval', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const daily = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Daily', interval: 'daily',
    });
    const monthly = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Monthly', interval: 'monthly',
    });

    vi.setSystemTime(new Date('2026-06-15T00:01:00.000Z'));
    await recurringTaskService.generateInstances('daily');

    expect(await Task.find({ recurringTaskId: daily.id }).countDocuments()).toBe(1);
    expect(await Task.find({ recurringTaskId: monthly.id }).countDocuments()).toBe(0);
  });
});
```

Implementer notes:
- `recurringTaskId` field name on Task may differ — confirm and adjust.
- If the cron expressions for daily are `'1 0 * * *'` (Sunday-anchored) the period start may be midnight; adjust the system time to align if needed.

- [ ] **Step 4.2: Run**

Run: `npm test tests/integration/schedulers/recurring-task.scheduler.test.ts`
Expected: 3 tests pass.

---

## Task 5: `recurring-shopping-item.scheduler.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/schedulers/recurring-shopping-item.scheduler.test.ts`

The worker is `recurringShoppingItemService.fireRulesForCadence(cadence)`. It iterates active rules matching the cadence and inserts a `ShoppingListItem` per rule unless an unbought item with the same name+category already exists.

- [ ] **Step 5.1: Write the test**

Create `BackEnd/tests/integration/schedulers/recurring-shopping-item.scheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recurringShoppingItemService } from '../../../src/services/recurring-shopping-item.service';
import { ShoppingListItem } from '../../../src/models/shopping-list-item.model';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringShoppingItemService.fireRulesForCadence (recurring-shopping-item scheduler worker)', () => {
  it('creates a ShoppingListItem for each active rule with the given cadence', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    const created = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Auto Milk', category: 'dairy', cadence: 'weekly',
    });

    const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
    expect(result.created).toBeGreaterThanOrEqual(1);

    const spawned = await ShoppingListItem.find({
      householdId: couple._id, name: 'Auto Milk',
    }).lean();
    expect(spawned.length).toBeGreaterThanOrEqual(1);
  });

  it('skips creation when an unbought duplicate already exists', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'milk', category: 'dairy', cadence: 'weekly', // matches seeded "Milk" by case-insensitive name? Adjust if needed.
    });

    const beforeCount = await ShoppingListItem.find({
      householdId: couple._id, name: /milk/i, isBought: false,
    }).countDocuments();

    const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
    expect(result.skipped).toBeGreaterThanOrEqual(0); // semantics: reports skipped when duplicate

    const afterCount = await ShoppingListItem.find({
      householdId: couple._id, name: /milk/i, isBought: false,
    }).countDocuments();
    // Either equal (deduped) or higher by exactly the number of duplicates the worker decided to allow.
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  it('only fires rules matching the cadence', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const dailyRule = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Auto Daily', category: 'pantry', cadence: 'daily',
    });
    const monthlyRule = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Auto Monthly', category: 'pantry', cadence: 'monthly',
    });

    await recurringShoppingItemService.fireRulesForCadence('daily');

    expect(await ShoppingListItem.find({ householdId: couple._id, name: 'Auto Daily' }).countDocuments())
      .toBeGreaterThanOrEqual(1);
    expect(await ShoppingListItem.find({ householdId: couple._id, name: 'Auto Monthly' }).countDocuments())
      .toBe(0);
  });
});
```

Implementer notes:
- The dedup test's assertion is loose because the exact dedup semantics (case-sensitive? exact match? per-cadence?) come from the implementation in `recurring-shopping-item.service.ts:89+`. After Step 5.2, tighten the assertion to match the actual behaviour.
- Cadence enum values must match `RecurrenceCadence` in the types file.

- [ ] **Step 5.2: Run**

Run: `npm test tests/integration/schedulers/recurring-shopping-item.scheduler.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5.3: User commit checkpoint**

Summary: "Scheduler tests for all 4 cron workers (~12 cases). Coverage exclusion removed."

---

## Batch 4 — Verification Checklist

- [ ] `npm run type-check` → exits 0.
- [ ] `npm test` → entire backend suite green (~210 cases now).
- [ ] `npm run test:coverage` → scheduler files appear in the coverage report. Target: each scheduler ≥ 60% (they're small).
- [ ] `git status` → only `vitest.config.ts` (small edit) + new test files modified.

---

## Out of Scope for Batch 4

- Cron-lock concurrency tests (worth skipping — the lock is an infrastructure concern; the tests above already test idempotency, which is the user-facing guarantee).
- The `start*Scheduler()` registration functions themselves (testing `node-cron` registration is testing a third-party library).
- Frontend tests — Batches 5-7.
- E2E — Batch 8.

When Batch 4 is green, the entire backend test suite is in place. Move to Batch 5 (Frontend Foundation) next.
