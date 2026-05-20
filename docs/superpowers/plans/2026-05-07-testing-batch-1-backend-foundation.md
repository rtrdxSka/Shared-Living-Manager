# Testing — Batch 1: Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the backend testing foundation: Vitest + supertest + Dockerised MongoDB + a rich seed script that drops & reseeds before each test file. Ends with a passing smoke test (`POST /api/auth/register`) so the rest of the test batches can be written on a known-good base.

**Architecture:** Vitest runs in Node mode (no jsdom). A `docker-compose.test.yml` boots MongoDB on host port 27018. `tests/setup.ts`, registered via `vitest.config.ts` `setupFiles`, connects Mongoose, drops the `slm-test-backend` database, runs `seedDatabase()`, and disconnects after the file. Tests reference canonical seed entities through `FIXTURES` and create ad-hoc data through `factories.ts`. supertest hits the exported `app` from `BackEnd/src/index.ts`; a `NODE_ENV=test` guard prevents `startServer()` from auto-running on import.

**Tech Stack:** Vitest 1.6+, supertest 7+, MongoDB 7 (Docker), Mongoose 9 (existing), TypeScript 5.9 (existing), bcryptjs (existing).

**User commit policy:** This user commits manually. Where the plan says **"User commit checkpoint"**, stop, summarise what changed, and wait for the user to review and commit before proceeding.

---

## File Structure

### Files to create
- `BackEnd/vitest.config.ts` — Vitest config: node env, setupFiles, ts loader, env-var injection.
- `BackEnd/docker-compose.test.yml` — Single MongoDB service on host port 27018.
- `BackEnd/.env.test` — Env vars used during `npm test` (loaded by vitest's setupFiles).
- `BackEnd/tests/setup.ts` — Global setup that runs once per test file: connect Mongoose, drop DB, seed, then disconnect on `afterAll`.
- `BackEnd/tests/helpers/db.ts` — `awaitMongoReady`, `dropDatabase`, `disconnectMongoose`.
- `BackEnd/tests/helpers/auth.ts` — `signTestJwt(userId)`, `authedAgent(app, userId)`.
- `BackEnd/tests/helpers/factories.ts` — Ad-hoc factories for users/households/expenses/tasks/goals (used inside individual tests when `FIXTURES` data isn't enough).
- `BackEnd/tests/mocks/email.mock.ts` — `vi.mock` exports that replace `src/utils/email.ts` with `vi.fn()` stubs.
- `BackEnd/tests/mocks/logger.mock.ts` — Silent pino logger.
- `BackEnd/tests/seed/seed.ts` — `seedDatabase()` that reads `data/*.json` and inserts via Mongoose models.
- `BackEnd/tests/seed/fixtures.ts` — `FIXTURES` constant exporting canonical IDs/emails for tests to reference.
- `BackEnd/tests/seed/data/users.json` — 6 users.
- `BackEnd/tests/seed/data/households.json` — 3 households.
- `BackEnd/tests/seed/data/expenses.json` — 12 expenses across statuses/categories/dates.
- `BackEnd/tests/seed/data/tasks.json` — 6 tasks.
- `BackEnd/tests/seed/data/goals.json` — 3 goals with contributions.
- `BackEnd/tests/seed/data/shopping-items.json` — 8 items.
- `BackEnd/tests/seed/data/joint-account-tx.json` — 6 transactions.
- `BackEnd/tests/integration/auth.smoke.test.ts` — Smoke test that drives `POST /api/auth/register` end-to-end against the real DB.

### Files to modify
- `BackEnd/package.json` — Add devDependencies (`vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`, `dotenv-cli`, `wait-on`) and scripts (`test`, `test:coverage`, `test:db:up`, `test:db:down`, `pretest`).
- `BackEnd/src/index.ts:171` — Wrap `startServer()` in a `NODE_ENV !== 'test'` guard so importing `app` in tests doesn't auto-start the HTTP listener, schedulers, or DB.

---

## Task 0: Pre-flight verification

**Files:** read-only

- [ ] **Step 0.1: Confirm Docker is available**

Run: `docker --version && docker compose version`
Expected: prints versions for both. If Docker is not installed, stop and ask the user to install Docker Desktop or the Docker engine + compose plugin before continuing.

- [ ] **Step 0.2: Confirm host port 27018 is free**

Run: `ss -ltn 'sport = :27018' | tail -n +2 | wc -l`
Expected: `0`. If non-zero, ask the user which port to use instead and substitute it for 27018 throughout the rest of this plan.

- [ ] **Step 0.3: Confirm Resend module shape (no code change here, just verify)**

Read `BackEnd/src/utils/email.ts:23-34` — the file uses lazy `getResendClient()` and exports `sendVerificationEmail` and `sendPasswordResetEmail` as top-level async functions. This shape works with `vi.mock('../utils/email')` without code changes. If the file diverges from this shape at the time of execution, update Task 7 (email mock) accordingly.

---

## Task 1: Modify `index.ts` so importing `app` doesn't auto-start the server

**Files:**
- Modify: `BackEnd/src/index.ts:171`

The bug: `startServer()` is called unconditionally on module import. supertest needs to import `app` without booting the HTTP listener, schedulers, and DB. We gate the call behind `process.env.NODE_ENV !== 'test'`.

- [ ] **Step 1.1: Replace the `startServer()` call**

Open `BackEnd/src/index.ts`. Find line 171 (`startServer();`) and replace it with the conditional below. Leave everything else untouched.

```ts
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
```

- [ ] **Step 1.2: Type-check still passes**

Run: `npm run type-check` (in `BackEnd/`)
Expected: exits 0 with no errors.

- [ ] **Step 1.3: Sanity-run the dev server**

Run: `npm run dev` (in `BackEnd/`) for ~5 seconds, then Ctrl-C.
Expected: logs include `🚀 Server running on port 5000` (or whatever port). Confirms the guard didn't break the normal boot path.

- [ ] **Step 1.4: User commit checkpoint**

Summary: "Gated `startServer()` behind `NODE_ENV !== 'test'` so tests can import `app` without auto-booting." Wait for user to commit before continuing.

---

## Task 2: Add devDependencies and npm scripts

**Files:**
- Modify: `BackEnd/package.json`

- [ ] **Step 2.1: Install devDependencies**

Run from `BackEnd/`:

```bash
npm install --save-dev \
  vitest@1.6.0 \
  @vitest/coverage-v8@1.6.0 \
  supertest@7.0.0 \
  @types/supertest@6.0.2 \
  dotenv-cli@7.4.2 \
  wait-on@8.0.1
```

Expected: installs successfully, `package.json` `devDependencies` updated, `package-lock.json` updated.

- [ ] **Step 2.2: Replace the `scripts` block**

In `BackEnd/package.json`, replace the `"scripts"` object (currently lines 6-12) with:

```json
  "scripts": {
    "test": "dotenv -e .env.test -- vitest run",
    "test:watch": "dotenv -e .env.test -- vitest",
    "test:coverage": "dotenv -e .env.test -- vitest run --coverage",
    "test:db:up": "docker compose -f docker-compose.test.yml up -d && wait-on tcp:127.0.0.1:27018",
    "test:db:down": "docker compose -f docker-compose.test.yml down -v",
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
```

- [ ] **Step 2.3: Verify scripts parse**

Run: `npm run` (lists scripts). Expected: shows the new entries (`test`, `test:watch`, `test:coverage`, `test:db:up`, `test:db:down`).

- [ ] **Step 2.4: User commit checkpoint**

Summary: "Added Vitest + supertest + dotenv-cli + wait-on devDependencies, plus test scripts." Wait for user to commit.

---

## Task 3: Create the test MongoDB compose file

**Files:**
- Create: `BackEnd/docker-compose.test.yml`

- [ ] **Step 3.1: Write the compose file**

Create `BackEnd/docker-compose.test.yml`:

```yaml
services:
  mongo-test:
    image: mongo:7
    container_name: slm-mongo-test
    ports:
      - "127.0.0.1:27018:27017"
    command: ["--quiet", "--logpath", "/dev/null"]
    tmpfs:
      - /data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 2s
      timeout: 2s
      retries: 10
```

Notes for the implementer:
- `tmpfs: /data/db` makes data live in RAM only — fast resets, no leftover state across runs.
- Bound to `127.0.0.1:27018` so it never listens on the LAN.
- No auth: this is a throwaway test container; do not point it at production data.

- [ ] **Step 3.2: Bring it up**

Run from `BackEnd/`: `npm run test:db:up`
Expected: container starts, `wait-on` returns within ~5s once port 27018 accepts connections.

- [ ] **Step 3.3: Verify connectivity**

Run: `docker exec slm-mongo-test mongosh --quiet --eval "db.adminCommand('ping')"`
Expected: prints `{ ok: 1 }`.

- [ ] **Step 3.4: Tear down again**

Run: `npm run test:db:down`
Expected: container stops and is removed.

- [ ] **Step 3.5: User commit checkpoint**

Summary: "Added docker-compose.test.yml for the throwaway test MongoDB on port 27018." Wait for user to commit.

---

## Task 4: Create `.env.test`

**Files:**
- Create: `BackEnd/.env.test`

- [ ] **Step 4.1: Write the file**

Create `BackEnd/.env.test`:

```env
NODE_ENV=test
PORT=0
MONGODB_URI=mongodb://127.0.0.1:27018/slm-test-backend
JWT_SECRET=test-jwt-secret-do-not-use-in-prod
JWT_REFRESH_SECRET=test-jwt-refresh-secret-do-not-use-in-prod
RESEND_API_KEY=test-key-mocked
FROM_EMAIL=test@example.com
FRONTEND_URL=http://localhost:5173
BCRYPT_SALT_ROUNDS=4
```

Notes:
- `BCRYPT_SALT_ROUNDS=4` keeps password hashing fast in tests; production uses 12.
- `RESEND_API_KEY` is set so `getResendClient()` doesn't throw if a code path imports `email.ts` before the mock activates; tests always mock the module at the boundary.

- [ ] **Step 4.2: Update .gitignore (if needed)**

Run: `grep -F ".env.test" BackEnd/.gitignore`
- If it appears: skip.
- If `.gitignore` already excludes all `.env*` (check for a pattern like `.env*` or `.env` — ask the user if the pattern is ambiguous): the file will be ignored. We **want** `.env.test` checked in (no real secrets in it). Add an explicit allowlist line `!.env.test` to `BackEnd/.gitignore` immediately under the `.env*` pattern.

- [ ] **Step 4.3: User commit checkpoint**

Summary: "Added `.env.test` with non-secret test config; allowlisted in .gitignore if needed." Wait for user to commit.

---

## Task 5: Create `tests/helpers/db.ts`

**Files:**
- Create: `BackEnd/tests/helpers/db.ts`

- [ ] **Step 5.1: Write the helper**

Create `BackEnd/tests/helpers/db.ts`:

```ts
import mongoose from 'mongoose';

export const connectTestMongo = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — make sure dotenv loaded .env.test');
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 5000,
    maxPoolSize: 5,
  });
};

export const dropDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Cannot drop database: mongoose is not connected');
  }
  const dbName = mongoose.connection.name;
  if (!dbName.startsWith('slm-test')) {
    throw new Error(
      `Refusing to drop database "${dbName}" — only databases starting with "slm-test" can be dropped.`
    );
  }
  await mongoose.connection.dropDatabase();
};

export const disconnectMongoose = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
};
```

The `slm-test` prefix guard is deliberate: a typo in `MONGODB_URI` should never wipe a real database.

- [ ] **Step 5.2: Type-check**

Run: `npm run type-check`
Expected: exits 0.

---

## Task 6: Create `tests/mocks/logger.mock.ts`

**Files:**
- Create: `BackEnd/tests/mocks/logger.mock.ts`

- [ ] **Step 6.1: Write the mock**

Create `BackEnd/tests/mocks/logger.mock.ts`:

```ts
import { vi } from 'vitest';

vi.mock('../../src/utils/logger', () => {
  const noop = vi.fn();
  const logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    child: () => logger,
  };
  return { logger, default: logger };
});
```

This file is imported once globally via `vitest.config.ts` `setupFiles` (next task). It silences pino so test output stays clean.

---

## Task 7: Create `tests/mocks/email.mock.ts`

**Files:**
- Create: `BackEnd/tests/mocks/email.mock.ts`

- [ ] **Step 7.1: Write the mock**

Create `BackEnd/tests/mocks/email.mock.ts`:

```ts
import { vi } from 'vitest';

vi.mock('../../src/utils/email', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));
```

Tests that need to assert email sends will `import * as emailMod from '../../src/utils/email'` and check `vi.mocked(emailMod.sendVerificationEmail)`.

---

## Task 8: Create seed JSON data files

**Files:**
- Create: `BackEnd/tests/seed/data/users.json`
- Create: `BackEnd/tests/seed/data/households.json`
- Create: `BackEnd/tests/seed/data/expenses.json`
- Create: `BackEnd/tests/seed/data/tasks.json`
- Create: `BackEnd/tests/seed/data/goals.json`
- Create: `BackEnd/tests/seed/data/shopping-items.json`
- Create: `BackEnd/tests/seed/data/joint-account-tx.json`

Stable string keys are used instead of ObjectIds — the seed script (Task 9) maps these keys to fresh ObjectIds at insert time and exposes them via `FIXTURES` (Task 10). This keeps the JSON readable and future-edits painless.

- [ ] **Step 8.1: Write `users.json`**

Create `BackEnd/tests/seed/data/users.json`:

```json
[
  {
    "key": "alice",
    "email": "alice@example.com",
    "password": "Password123!",
    "firstName": "Alice",
    "lastName": "Anderson",
    "isEmailVerified": true,
    "preferences": { "language": "en", "currency": "BGN" }
  },
  {
    "key": "bob",
    "email": "bob@example.com",
    "password": "Password123!",
    "firstName": "Bob",
    "lastName": "Brown",
    "isEmailVerified": true,
    "preferences": { "language": "en", "currency": "BGN" }
  },
  {
    "key": "carol",
    "email": "carol@example.com",
    "password": "Password123!",
    "firstName": "Carol",
    "lastName": "Carter",
    "isEmailVerified": true,
    "preferences": { "language": "en", "currency": "BGN" }
  },
  {
    "key": "dave",
    "email": "dave@example.com",
    "password": "Password123!",
    "firstName": "Dave",
    "lastName": "Davis",
    "isEmailVerified": false,
    "preferences": { "language": "en", "currency": "BGN" }
  },
  {
    "key": "eve",
    "email": "eve@example.com",
    "password": "Password123!",
    "firstName": "Eve",
    "lastName": "Evans",
    "isEmailVerified": true,
    "preferences": { "language": "en", "currency": "BGN" }
  },
  {
    "key": "frank",
    "email": "frank@example.com",
    "password": "Password123!",
    "firstName": "Frank",
    "lastName": "Foster",
    "isEmailVerified": true,
    "preferences": { "language": "en", "currency": "BGN" }
  }
]
```

`dave` has `isEmailVerified: false` so tests for the email-verified middleware have a ready-made unverified user.

- [ ] **Step 8.2: Write `households.json`**

Create `BackEnd/tests/seed/data/households.json`:

```json
[
  {
    "key": "couple",
    "name": "Alice & Bob",
    "livingArrangement": "couple",
    "totalMembers": 2,
    "uiMode": "couple",
    "createdByKey": "alice",
    "inviteCode": "couple-invite-0001",
    "members": [
      {
        "memberKey": "alice-member",
        "userKey": "alice",
        "nickname": "Alice",
        "ageGroup": "26-35",
        "role": "owner",
        "isCreator": true,
        "participatesInFinances": true,
        "participatesInTasks": true,
        "monthlyIncome": 3500
      },
      {
        "memberKey": "bob-member",
        "userKey": "bob",
        "nickname": "Bob",
        "ageGroup": "26-35",
        "role": "member",
        "isCreator": false,
        "participatesInFinances": true,
        "participatesInTasks": true,
        "monthlyIncome": 2800
      }
    ],
    "settings": {
      "financeMode": "shared",
      "expenseSplitMethod": "income",
      "currency": "BGN",
      "taskManagementEnabled": "full",
      "taskDistributionMethod": "rotation",
      "trackedExpenseTypes": ["rent", "utilities", "groceries", "entertainment"]
    }
  },
  {
    "key": "flatshare",
    "name": "The Flat",
    "livingArrangement": "shared_flat",
    "totalMembers": 3,
    "uiMode": "general",
    "createdByKey": "carol",
    "inviteCode": "flat-invite-0002",
    "members": [
      {
        "memberKey": "carol-member",
        "userKey": "carol",
        "nickname": "Carol",
        "ageGroup": "26-35",
        "role": "owner",
        "isCreator": true,
        "participatesInFinances": true,
        "participatesInTasks": true,
        "monthlyIncome": 3000
      },
      {
        "memberKey": "eve-member",
        "userKey": "eve",
        "nickname": "Eve",
        "ageGroup": "26-35",
        "role": "admin",
        "isCreator": false,
        "participatesInFinances": true,
        "participatesInTasks": true,
        "monthlyIncome": 2500
      },
      {
        "memberKey": "frank-member",
        "userKey": "frank",
        "nickname": "Frank",
        "ageGroup": "36-45",
        "role": "member",
        "isCreator": false,
        "participatesInFinances": true,
        "participatesInTasks": false,
        "monthlyIncome": 2200
      }
    ],
    "settings": {
      "financeMode": "split",
      "expenseSplitMethod": "equal",
      "currency": "BGN",
      "taskManagementEnabled": "basic",
      "taskDistributionMethod": "manual",
      "trackedExpenseTypes": ["rent", "utilities", "groceries"]
    }
  },
  {
    "key": "solo",
    "name": "Dave's Studio",
    "livingArrangement": "alone",
    "totalMembers": 1,
    "uiMode": "general",
    "createdByKey": "dave",
    "inviteCode": "solo-invite-0003",
    "members": [
      {
        "memberKey": "dave-member",
        "userKey": "dave",
        "nickname": "Dave",
        "ageGroup": "18-25",
        "role": "owner",
        "isCreator": true,
        "participatesInFinances": true,
        "participatesInTasks": true,
        "monthlyIncome": 1800
      }
    ],
    "settings": {
      "financeMode": "personal",
      "currency": "BGN",
      "taskManagementEnabled": "off",
      "trackedExpenseTypes": ["rent", "groceries"]
    }
  }
]
```

Implementer note: the enum values (`livingArrangement`, `ageGroup`, `role`, `financeMode`, `expenseSplitMethod`, `taskManagementEnabled`, `taskDistributionMethod`) must match the constants exported from `BackEnd/src/types/household.types.ts` and `BackEnd/src/types/joint-account.types.ts`. If the seed insertion fails with a Mongoose enum validation error, open those files and adjust the JSON to match the actual allowed values — do not change the type files.

- [ ] **Step 8.3: Write `expenses.json`**

Create `BackEnd/tests/seed/data/expenses.json`:

```json
[
  {
    "key": "rent-april",
    "householdKey": "couple",
    "paidByMemberKey": "alice-member",
    "title": "April Rent",
    "amount": 1200,
    "category": "rent",
    "occurredAt": "2026-04-01T09:00:00.000Z",
    "status": "settled",
    "notes": "Paid via bank transfer"
  },
  {
    "key": "groceries-week1",
    "householdKey": "couple",
    "paidByMemberKey": "bob-member",
    "title": "Groceries — week 1",
    "amount": 87.5,
    "category": "groceries",
    "occurredAt": "2026-04-08T18:30:00.000Z",
    "status": "pending"
  },
  {
    "key": "utilities-april",
    "householdKey": "couple",
    "paidByMemberKey": "alice-member",
    "title": "Electricity + Internet — April",
    "amount": 145.2,
    "category": "utilities",
    "occurredAt": "2026-04-15T12:00:00.000Z",
    "status": "claimed",
    "claimedByMemberKey": "bob-member"
  },
  {
    "key": "dinner-out",
    "householdKey": "couple",
    "paidByMemberKey": "bob-member",
    "title": "Dinner at Manastira",
    "amount": 64,
    "category": "entertainment",
    "occurredAt": "2026-04-22T20:00:00.000Z",
    "status": "pending"
  },
  {
    "key": "rent-may",
    "householdKey": "couple",
    "paidByMemberKey": "alice-member",
    "title": "May Rent",
    "amount": 1200,
    "category": "rent",
    "occurredAt": "2026-05-01T09:00:00.000Z",
    "status": "pending"
  },
  {
    "key": "flat-rent-april",
    "householdKey": "flatshare",
    "paidByMemberKey": "carol-member",
    "title": "Flat Rent — April",
    "amount": 1500,
    "category": "rent",
    "occurredAt": "2026-04-01T09:00:00.000Z",
    "status": "settled"
  },
  {
    "key": "flat-internet",
    "householdKey": "flatshare",
    "paidByMemberKey": "eve-member",
    "title": "Internet — April",
    "amount": 30,
    "category": "utilities",
    "occurredAt": "2026-04-10T14:00:00.000Z",
    "status": "pending"
  },
  {
    "key": "flat-groceries-1",
    "householdKey": "flatshare",
    "paidByMemberKey": "carol-member",
    "title": "Groceries — Lidl",
    "amount": 55.4,
    "category": "groceries",
    "occurredAt": "2026-04-12T17:15:00.000Z",
    "status": "pending"
  },
  {
    "key": "flat-groceries-2",
    "householdKey": "flatshare",
    "paidByMemberKey": "frank-member",
    "title": "Groceries — Kaufland",
    "amount": 78.9,
    "category": "groceries",
    "occurredAt": "2026-04-18T19:00:00.000Z",
    "status": "claimed",
    "claimedByMemberKey": "carol-member"
  },
  {
    "key": "flat-cleaning",
    "householdKey": "flatshare",
    "paidByMemberKey": "eve-member",
    "title": "Cleaning Supplies",
    "amount": 22.5,
    "category": "household",
    "occurredAt": "2026-04-20T11:00:00.000Z",
    "status": "pending"
  },
  {
    "key": "solo-rent-april",
    "householdKey": "solo",
    "paidByMemberKey": "dave-member",
    "title": "Studio Rent — April",
    "amount": 700,
    "category": "rent",
    "occurredAt": "2026-04-01T09:00:00.000Z",
    "status": "settled"
  },
  {
    "key": "solo-groceries",
    "householdKey": "solo",
    "paidByMemberKey": "dave-member",
    "title": "Groceries",
    "amount": 41.2,
    "category": "groceries",
    "occurredAt": "2026-04-14T16:00:00.000Z",
    "status": "settled"
  }
]
```

Implementer note: `status` and `category` enum values must match `BackEnd/src/types/expense.types.ts`. Fix the JSON if a Mongoose enum error fires — never change the types file.

- [ ] **Step 8.4: Write `tasks.json`**

Create `BackEnd/tests/seed/data/tasks.json`:

```json
[
  {
    "key": "dishes",
    "householdKey": "couple",
    "title": "Wash the dishes",
    "createdByMemberKey": "alice-member",
    "assignedToMemberKey": "bob-member",
    "isCompleted": false,
    "createdAt": "2026-05-01T08:00:00.000Z"
  },
  {
    "key": "trash",
    "householdKey": "couple",
    "title": "Take out the trash",
    "createdByMemberKey": "alice-member",
    "assignedToMemberKey": "alice-member",
    "isCompleted": true,
    "completedAt": "2026-05-02T19:00:00.000Z",
    "createdAt": "2026-05-02T08:00:00.000Z"
  },
  {
    "key": "vacuum",
    "householdKey": "couple",
    "title": "Vacuum living room",
    "createdByMemberKey": "alice-member",
    "isCompleted": false,
    "createdAt": "2026-05-03T08:00:00.000Z"
  },
  {
    "key": "flat-bathroom",
    "householdKey": "flatshare",
    "title": "Clean the bathroom",
    "createdByMemberKey": "carol-member",
    "assignedToMemberKey": "carol-member",
    "isCompleted": false,
    "createdAt": "2026-05-01T09:00:00.000Z"
  },
  {
    "key": "flat-kitchen",
    "householdKey": "flatshare",
    "title": "Clean the kitchen",
    "createdByMemberKey": "eve-member",
    "assignedToMemberKey": "eve-member",
    "isCompleted": false,
    "createdAt": "2026-05-02T09:00:00.000Z"
  },
  {
    "key": "flat-shopping",
    "householdKey": "flatshare",
    "title": "Weekly shopping run",
    "createdByMemberKey": "carol-member",
    "isCompleted": false,
    "createdAt": "2026-05-03T09:00:00.000Z"
  }
]
```

Implementer note: the Task model fields must match `BackEnd/src/types/task.types.ts`. The seed inserts via the real Mongoose model, so any field mismatch surfaces as a clear validation error.

- [ ] **Step 8.5: Write `goals.json`**

Create `BackEnd/tests/seed/data/goals.json`:

```json
[
  {
    "key": "vacation",
    "householdKey": "couple",
    "title": "Summer Vacation",
    "targetAmount": 2500,
    "createdByMemberKey": "alice-member",
    "contributions": [
      { "memberKey": "alice-member", "amount": 500, "occurredAt": "2026-04-05T10:00:00.000Z" },
      { "memberKey": "bob-member",   "amount": 400, "occurredAt": "2026-04-12T10:00:00.000Z" }
    ]
  },
  {
    "key": "new-couch",
    "householdKey": "couple",
    "title": "New Couch",
    "targetAmount": 800,
    "createdByMemberKey": "bob-member",
    "contributions": [
      { "memberKey": "alice-member", "amount": 200, "occurredAt": "2026-04-20T10:00:00.000Z" }
    ]
  },
  {
    "key": "flat-tv",
    "householdKey": "flatshare",
    "title": "Living Room TV",
    "targetAmount": 1200,
    "createdByMemberKey": "carol-member",
    "contributions": [
      { "memberKey": "carol-member", "amount": 100, "occurredAt": "2026-04-15T10:00:00.000Z" },
      { "memberKey": "eve-member",   "amount": 100, "occurredAt": "2026-04-15T11:00:00.000Z" }
    ]
  }
]
```

- [ ] **Step 8.6: Write `shopping-items.json`**

Create `BackEnd/tests/seed/data/shopping-items.json`:

```json
[
  { "key": "milk",       "householdKey": "couple",    "name": "Milk",       "quantity": 2, "category": "dairy",   "isBought": false, "createdByMemberKey": "alice-member" },
  { "key": "bread",      "householdKey": "couple",    "name": "Bread",      "quantity": 1, "category": "bakery",  "isBought": true,  "createdByMemberKey": "bob-member",   "boughtAt": "2026-05-05T18:00:00.000Z" },
  { "key": "apples",     "householdKey": "couple",    "name": "Apples",     "quantity": 6, "category": "produce", "isBought": false, "createdByMemberKey": "alice-member" },
  { "key": "shampoo",    "householdKey": "couple",    "name": "Shampoo",    "quantity": 1, "category": "toiletries","isBought": false,"createdByMemberKey": "bob-member" },
  { "key": "flat-eggs",  "householdKey": "flatshare", "name": "Eggs",       "quantity":12, "category": "dairy",   "isBought": false, "createdByMemberKey": "carol-member" },
  { "key": "flat-pasta", "householdKey": "flatshare", "name": "Pasta",      "quantity": 3, "category": "pantry",  "isBought": false, "createdByMemberKey": "eve-member" },
  { "key": "flat-soap",  "householdKey": "flatshare", "name": "Dish Soap",  "quantity": 1, "category": "household","isBought":true,  "createdByMemberKey": "frank-member","boughtAt": "2026-05-04T20:00:00.000Z" },
  { "key": "solo-cereal","householdKey": "solo",      "name": "Cereal",     "quantity": 2, "category": "pantry",  "isBought": false, "createdByMemberKey": "dave-member" }
]
```

Implementer note: the Shopping item field names and `category` values must match `BackEnd/src/types/shopping-list.types.ts`. Adjust JSON to match if needed.

- [ ] **Step 8.7: Write `joint-account-tx.json`**

Create `BackEnd/tests/seed/data/joint-account-tx.json`:

```json
[
  { "key": "tx-1", "householdKey": "couple", "byMemberKey": "alice-member", "type": "deposit",    "amount": 500,  "occurredAt": "2026-04-01T09:00:00.000Z", "note": "April contribution" },
  { "key": "tx-2", "householdKey": "couple", "byMemberKey": "bob-member",   "type": "deposit",    "amount": 400,  "occurredAt": "2026-04-01T09:30:00.000Z", "note": "April contribution" },
  { "key": "tx-3", "householdKey": "couple", "byMemberKey": "alice-member", "type": "withdrawal", "amount": 120,  "occurredAt": "2026-04-12T18:00:00.000Z", "note": "Groceries" },
  { "key": "tx-4", "householdKey": "couple", "byMemberKey": "bob-member",   "type": "withdrawal", "amount": 60,   "occurredAt": "2026-04-22T20:30:00.000Z", "note": "Dinner" },
  { "key": "tx-5", "householdKey": "flatshare", "byMemberKey": "carol-member", "type": "deposit",   "amount": 300, "occurredAt": "2026-04-01T09:00:00.000Z", "note": "April contribution" },
  { "key": "tx-6", "householdKey": "flatshare", "byMemberKey": "eve-member",   "type": "deposit",   "amount": 250, "occurredAt": "2026-04-01T09:30:00.000Z", "note": "April contribution" }
]
```

Implementer note: `type` enum values must match `BackEnd/src/types/joint-account.types.ts`.

- [ ] **Step 8.8: User commit checkpoint**

Summary: "Added rich seed data fixtures (users, households, expenses, tasks, goals, shopping items, joint-account transactions)." Wait for user to commit.

---

## Task 9: Create the seed script

**Files:**
- Create: `BackEnd/tests/seed/seed.ts`

The seed script reads each JSON file, generates ObjectIds for every keyed entity, then inserts via the real Mongoose models so all validation, defaults, and `pre('save')` hooks (notably User password hashing and Household invite-code generation) run.

- [ ] **Step 9.1: Locate the model exports**

Open and confirm the export paths/names. The seed script imports them; the names must match exactly.

Run: `grep -RnE "export const (User|Household|Expense|Task|Goal|ShoppingListItem|JointAccountTransaction)" BackEnd/src/models/`
Expected: shows the export name and file path for each model. If a model has a different name (e.g., `ShoppingItem` vs `ShoppingListItem`), update the import in the seed script to match.

- [ ] **Step 9.2: Write the seed script**

Create `BackEnd/tests/seed/seed.ts`:

```ts
import { Types } from 'mongoose';
import { User } from '../../src/models/user.model';
import { Household } from '../../src/models/household.model';
import { Expense } from '../../src/models/expense.model';
import { Task } from '../../src/models/task.model';
import { Goal } from '../../src/models/goal.model';
import { ShoppingListItem } from '../../src/models/shopping-list-item.model';
import { JointAccountTransaction } from '../../src/models/joint-account-transaction.model';

import usersData from './data/users.json';
import householdsData from './data/households.json';
import expensesData from './data/expenses.json';
import tasksData from './data/tasks.json';
import goalsData from './data/goals.json';
import shoppingData from './data/shopping-items.json';
import jointAccountData from './data/joint-account-tx.json';

type IdMap = Record<string, Types.ObjectId>;

const newId = () => new Types.ObjectId();

export interface SeedResult {
  userIds: IdMap;        // user "key" → User._id
  householdIds: IdMap;   // household "key" → Household._id
  memberIds: IdMap;      // member "memberKey" → member subdoc _id
  expenseIds: IdMap;
  taskIds: IdMap;
  goalIds: IdMap;
  shoppingIds: IdMap;
  jointTxIds: IdMap;
}

export const seedDatabase = async (): Promise<SeedResult> => {
  // ── Users ───────────────────────────────────────────────────────────
  const userIds: IdMap = {};
  for (const u of usersData) {
    const _id = newId();
    userIds[u.key] = _id;
    // Use `new User().save()` (not insertMany) so the pre-save password hash hook fires.
    await new User({
      _id,
      email: u.email,
      password: u.password,
      firstName: u.firstName,
      lastName: u.lastName,
      isEmailVerified: u.isEmailVerified,
      preferences: u.preferences,
    }).save();
  }

  // ── Households ──────────────────────────────────────────────────────
  const householdIds: IdMap = {};
  const memberIds: IdMap = {};
  for (const h of householdsData) {
    const _id = newId();
    householdIds[h.key] = _id;
    const members = h.members.map((m) => {
      const memberObjectId = newId();
      memberIds[m.memberKey] = memberObjectId;
      return {
        _id: memberObjectId,
        userId: userIds[m.userKey],
        nickname: m.nickname,
        ageGroup: m.ageGroup,
        role: m.role,
        isCreator: m.isCreator,
        participatesInFinances: m.participatesInFinances,
        participatesInTasks: m.participatesInTasks,
        monthlyIncome: m.monthlyIncome,
      };
    });
    await new Household({
      _id,
      name: h.name,
      livingArrangement: h.livingArrangement,
      totalMembers: h.totalMembers,
      uiMode: h.uiMode,
      createdBy: userIds[h.createdByKey],
      inviteCode: h.inviteCode,
      members,
      settings: h.settings,
    }).save();

    // Backfill User.households / activeHousehold so auth-flow tests behave like prod.
    for (const m of h.members) {
      await User.updateOne(
        { _id: userIds[m.userKey] },
        { $addToSet: { households: _id }, $set: { activeHousehold: _id } }
      );
    }
  }

  // ── Expenses ────────────────────────────────────────────────────────
  const expenseIds: IdMap = {};
  for (const e of expensesData) {
    const _id = newId();
    expenseIds[e.key] = _id;
    await Expense.create({
      _id,
      householdId: householdIds[e.householdKey],
      paidByMemberId: memberIds[e.paidByMemberKey],
      claimedByMemberId: e.claimedByMemberKey ? memberIds[e.claimedByMemberKey] : undefined,
      title: e.title,
      amount: e.amount,
      category: e.category,
      occurredAt: new Date(e.occurredAt),
      status: e.status,
      notes: e.notes,
    });
  }

  // ── Tasks ───────────────────────────────────────────────────────────
  const taskIds: IdMap = {};
  for (const t of tasksData) {
    const _id = newId();
    taskIds[t.key] = _id;
    await Task.create({
      _id,
      householdId: householdIds[t.householdKey],
      title: t.title,
      createdByMemberId: memberIds[t.createdByMemberKey],
      assignedToMemberId: t.assignedToMemberKey ? memberIds[t.assignedToMemberKey] : undefined,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      createdAt: new Date(t.createdAt),
    });
  }

  // ── Goals ───────────────────────────────────────────────────────────
  const goalIds: IdMap = {};
  for (const g of goalsData) {
    const _id = newId();
    goalIds[g.key] = _id;
    await Goal.create({
      _id,
      householdId: householdIds[g.householdKey],
      title: g.title,
      targetAmount: g.targetAmount,
      createdByMemberId: memberIds[g.createdByMemberKey],
      contributions: g.contributions.map((c) => ({
        memberId: memberIds[c.memberKey],
        amount: c.amount,
        occurredAt: new Date(c.occurredAt),
      })),
    });
  }

  // ── Shopping list ──────────────────────────────────────────────────
  const shoppingIds: IdMap = {};
  for (const s of shoppingData) {
    const _id = newId();
    shoppingIds[s.key] = _id;
    await ShoppingListItem.create({
      _id,
      householdId: householdIds[s.householdKey],
      name: s.name,
      quantity: s.quantity,
      category: s.category,
      isBought: s.isBought,
      boughtAt: s.boughtAt ? new Date(s.boughtAt) : undefined,
      createdByMemberId: memberIds[s.createdByMemberKey],
    });
  }

  // ── Joint account transactions ─────────────────────────────────────
  const jointTxIds: IdMap = {};
  for (const tx of jointAccountData) {
    const _id = newId();
    jointTxIds[tx.key] = _id;
    await JointAccountTransaction.create({
      _id,
      householdId: householdIds[tx.householdKey],
      byMemberId: memberIds[tx.byMemberKey],
      type: tx.type,
      amount: tx.amount,
      occurredAt: new Date(tx.occurredAt),
      note: tx.note,
    });
  }

  return { userIds, householdIds, memberIds, expenseIds, taskIds, goalIds, shoppingIds, jointTxIds };
};
```

Implementer note: if any of the imported model paths don't exist (e.g., `shopping-list-item.model.ts` is actually `shopping-item.model.ts`), grep showed the real paths in Step 9.1 — fix the import to match. The Expense / Task / Goal / Shopping / JointAccountTransaction field names should also match the type files; adjust the `Model.create({...})` calls if names differ. **Do not change the model files** — they are the source of truth.

- [ ] **Step 9.3: Enable JSON imports in tsconfig**

Read `BackEnd/tsconfig.json`. Verify `"resolveJsonModule": true` is set under `compilerOptions`. If absent, add it.

- [ ] **Step 9.4: Type-check**

Run: `npm run type-check`
Expected: exits 0. If TS complains about JSON shapes, add `"esModuleInterop": true` (likely already there) and consider widening the JSON types via `as const` casts in seed.ts.

---

## Task 10: Create `tests/seed/fixtures.ts`

**Files:**
- Create: `BackEnd/tests/seed/fixtures.ts`

`FIXTURES` is the canonical pointer used inside tests. After each `seedDatabase()` call (which happens in `tests/setup.ts`) it is repopulated with the live ObjectIds of the just-seeded entities.

- [ ] **Step 10.1: Write the fixture map**

Create `BackEnd/tests/seed/fixtures.ts`:

```ts
import { Types } from 'mongoose';
import type { SeedResult } from './seed';

import usersData from './data/users.json';
import householdsData from './data/households.json';
import expensesData from './data/expenses.json';
import tasksData from './data/tasks.json';
import goalsData from './data/goals.json';
import shoppingData from './data/shopping-items.json';
import jointAccountData from './data/joint-account-tx.json';

type UserKey = (typeof usersData)[number]['key'];
type HouseholdKey = (typeof householdsData)[number]['key'];
type MemberKey = (typeof householdsData)[number]['members'][number]['memberKey'];
type ExpenseKey = (typeof expensesData)[number]['key'];
type TaskKey = (typeof tasksData)[number]['key'];
type GoalKey = (typeof goalsData)[number]['key'];
type ShoppingKey = (typeof shoppingData)[number]['key'];
type JointTxKey = (typeof jointAccountData)[number]['key'];

interface Fixtures {
  user: (key: UserKey) => { _id: Types.ObjectId; email: string; password: string; firstName: string };
  household: (key: HouseholdKey) => { _id: Types.ObjectId; inviteCode: string };
  member: (key: MemberKey) => Types.ObjectId;
  expense: (key: ExpenseKey) => Types.ObjectId;
  task: (key: TaskKey) => Types.ObjectId;
  goal: (key: GoalKey) => Types.ObjectId;
  shopping: (key: ShoppingKey) => Types.ObjectId;
  jointTx: (key: JointTxKey) => Types.ObjectId;
}

let current: SeedResult | null = null;

export const setFixtures = (result: SeedResult): void => {
  current = result;
};

const must = (): SeedResult => {
  if (!current) throw new Error('FIXTURES not initialised — call setFixtures(seedResult) first.');
  return current;
};

export const FIXTURES: Fixtures = {
  user: (key) => {
    const data = usersData.find((u) => u.key === key);
    if (!data) throw new Error(`No seeded user with key "${key}"`);
    return { _id: must().userIds[key], email: data.email, password: data.password, firstName: data.firstName };
  },
  household: (key) => {
    const data = householdsData.find((h) => h.key === key);
    if (!data) throw new Error(`No seeded household with key "${key}"`);
    return { _id: must().householdIds[key], inviteCode: data.inviteCode };
  },
  member: (key) => must().memberIds[key],
  expense: (key) => must().expenseIds[key],
  task: (key) => must().taskIds[key],
  goal: (key) => must().goalIds[key],
  shopping: (key) => must().shoppingIds[key],
  jointTx: (key) => must().jointTxIds[key],
};
```

Tests use `FIXTURES.user('alice')` and the typescript compiler enforces that `'alice'` is a real key — typos surface at compile time.

- [ ] **Step 10.2: Type-check**

Run: `npm run type-check`
Expected: exits 0.

---

## Task 11: Create `tests/setup.ts`

**Files:**
- Create: `BackEnd/tests/setup.ts`

Vitest invokes `setupFiles` once per test file. Inside the file we register `beforeAll` (connect + reset + seed) and `afterAll` (disconnect). This implements the "drop + reseed before each test FILE" decision from the spec.

- [ ] **Step 11.1: Write the setup file**

Create `BackEnd/tests/setup.ts`:

```ts
import { beforeAll, afterAll } from 'vitest';
import './mocks/email.mock';
import './mocks/logger.mock';
import { connectTestMongo, dropDatabase, disconnectMongoose } from './helpers/db';
import { seedDatabase } from './seed/seed';
import { setFixtures } from './seed/fixtures';

beforeAll(async () => {
  await connectTestMongo();
  await dropDatabase();
  const result = await seedDatabase();
  setFixtures(result);
}, 30_000);

afterAll(async () => {
  await disconnectMongoose();
});
```

The 30s timeout covers cold-start cases (first connection, slow CI containers).

---

## Task 12: Create `vitest.config.ts`

**Files:**
- Create: `BackEnd/vitest.config.ts`

- [ ] **Step 12.1: Write the config**

Create `BackEnd/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Each test file gets its own worker; setupFiles re-runs per file → fresh seed per file.
    fileParallelism: true,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/instrument.ts',
        // Batch 4 will add scheduler tests — when that lands, REMOVE the next line
        // so coverage reflects scheduler code.
        'src/scheduler/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
```

`pool: 'forks'` (vs threads) keeps Mongoose's connection-state isolated per test file — running multiple files concurrently in the same thread can deadlock Mongoose's connection pool.

---

## Task 13: Create `tests/helpers/auth.ts`

**Files:**
- Create: `BackEnd/tests/helpers/auth.ts`

- [ ] **Step 13.1: Inspect how the production auth middleware reads JWTs**

Run: `grep -n "verify\|payload\|req.user" BackEnd/src/middleware/auth.ts`
Expected: shows the JWT payload shape. Whatever fields the middleware reads (`userId`, `id`, `sub`, etc.) must be in the payload we sign here.

- [ ] **Step 13.2: Write the helper**

Create `BackEnd/tests/helpers/auth.ts`. **If Step 13.1 showed a payload field other than `userId`, edit this file accordingly.**

```ts
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import request, { type SuperAgentTest, type Test } from 'supertest';
import type { Application } from 'express';

const TEST_JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in test env');
  return secret;
};

export const signTestJwt = (userId: Types.ObjectId | string, expiresIn = '1h'): string => {
  return jwt.sign({ userId: userId.toString() }, TEST_JWT_SECRET(), { expiresIn });
};

/**
 * Returns a thin wrapper that attaches the Authorization header to every request.
 * Usage:
 *   const agent = authedAgent(app, FIXTURES.user('alice')._id);
 *   await agent.get('/api/households/...').expect(200);
 */
export const authedAgent = (app: Application, userId: Types.ObjectId | string) => {
  const token = signTestJwt(userId);
  const wrap = (req: Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    get:    (url: string) => wrap(request(app).get(url)),
    post:   (url: string) => wrap(request(app).post(url)),
    patch:  (url: string) => wrap(request(app).patch(url)),
    put:    (url: string) => wrap(request(app).put(url)),
    delete: (url: string) => wrap(request(app).delete(url)),
  };
};
```

- [ ] **Step 13.3: Type-check**

Run: `npm run type-check`
Expected: exits 0.

---

## Task 14: Create `tests/helpers/factories.ts`

**Files:**
- Create: `BackEnd/tests/helpers/factories.ts`

Factories produce ad-hoc data within a test (e.g., a second household to assert cross-household isolation). The seed handles the common case; factories handle the long tail.

- [ ] **Step 14.1: Write the factory file**

Create `BackEnd/tests/helpers/factories.ts`:

```ts
import { Types } from 'mongoose';
import { User } from '../../src/models/user.model';
import { Household } from '../../src/models/household.model';

let userCounter = 0;

export const makeUser = async (overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}> = {}) => {
  userCounter += 1;
  const email = overrides.email ?? `factory-user-${Date.now()}-${userCounter}@example.com`;
  const user = await new User({
    email,
    password: overrides.password ?? 'Password123!',
    firstName: overrides.firstName ?? `Test${userCounter}`,
    lastName: overrides.lastName ?? 'User',
    isEmailVerified: overrides.isEmailVerified ?? true,
  }).save();
  return user;
};

let householdCounter = 0;

export const makeHousehold = async (creatorUserId: Types.ObjectId, overrides: Partial<{
  name: string;
  inviteCode: string;
}> = {}) => {
  householdCounter += 1;
  const memberId = new Types.ObjectId();
  const household = await new Household({
    name: overrides.name ?? `Factory Household ${householdCounter}`,
    livingArrangement: 'couple',
    totalMembers: 1,
    uiMode: 'general',
    createdBy: creatorUserId,
    inviteCode: overrides.inviteCode,
    members: [
      {
        _id: memberId,
        userId: creatorUserId,
        nickname: 'Creator',
        ageGroup: '26-35',
        role: 'owner',
        isCreator: true,
        participatesInFinances: true,
        participatesInTasks: true,
      },
    ],
    settings: {
      currency: 'BGN',
      taskManagementEnabled: 'off',
      trackedExpenseTypes: [],
    },
  }).save();
  return { household, creatorMemberId: memberId };
};
```

The counter pattern keeps emails unique across factory calls within a test file even when timestamps collide.

- [ ] **Step 14.2: Type-check**

Run: `npm run type-check`
Expected: exits 0.

---

## Task 15: Write the smoke test (TDD-style: write the test, run it, watch it pass)

**Files:**
- Create: `BackEnd/tests/integration/auth.smoke.test.ts`

This is the test that proves the entire foundation works. It exercises supertest + the real app + the real DB + the password hash hook + the email mock + the seed data — every moving piece in Batch 1.

- [ ] **Step 15.1: Make sure the test DB is up**

Run from `BackEnd/`: `npm run test:db:up`
Expected: container starts, port 27018 is up.

- [ ] **Step 15.2: Write the smoke test**

Create `BackEnd/tests/integration/auth.smoke.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import app from '../../src/index';
import request from 'supertest';
import * as emailMod from '../../src/utils/email';
import { User } from '../../src/models/user.model';
import { FIXTURES } from '../seed/fixtures';

describe('POST /api/auth/register (smoke)', () => {
  it('returns 201 and creates a user with a hashed password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

    expect(res.status).toBe(201);

    const created = await User.findOne({ email: 'newuser@example.com' }).select('+password').lean();
    expect(created).not.toBeNull();
    expect(created!.password).not.toBe('Password123!'); // bcrypt-hashed
    expect(created!.password.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate email with 409', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: alice.email,
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Imposter',
      });

    expect(res.status).toBe(409);
  });

  it('calls sendVerificationEmail with the new user info', async () => {
    const sendMock = vi.mocked(emailMod.sendVerificationEmail);
    sendMock.mockClear();

    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'verify-me@example.com',
        password: 'Password123!',
        firstName: 'Verify',
        lastName: 'Me',
      })
      .expect(201);

    expect(sendMock).toHaveBeenCalledOnce();
    const [to, firstName] = sendMock.mock.calls[0];
    expect(to).toBe('verify-me@example.com');
    expect(firstName).toBe('Verify');
  });
});
```

Implementer notes:
- The expected status code (201 vs 200, 409 vs 400) and the email mock call signature must match what the production code actually does. If `auth.controller.ts` returns 200, change `.toBe(201)` to `.toBe(200)`. If duplicate emails return 400, adjust accordingly. **Adjust the test to match the production behaviour, not the other way around** — the smoke test's job is to confirm the wiring, not to dictate API contracts.
- If the email mock signature is `sendVerificationEmail(to, firstName, token)`, the `[to, firstName]` destructure is correct. If it's different, adjust.

- [ ] **Step 15.3: Run the test to verify it passes**

Run from `BackEnd/`: `npm test`
Expected:
```
 ✓ tests/integration/auth.smoke.test.ts (3)
   ✓ POST /api/auth/register (smoke) (3)
     ✓ returns 201 and creates a user with a hashed password
     ✓ rejects duplicate email with 409
     ✓ calls sendVerificationEmail with the new user info

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

If a test fails, debug in this order:
1. **Connection failure**: ensure `npm run test:db:up` is up, port 27018 reachable.
2. **Seed validation error** (`ValidationError: Path \`X\` is required`): JSON enum/field doesn't match the model — fix the JSON.
3. **Status mismatch (e.g., expected 201 got 200)**: adjust the expectation in the test to match the production controller.
4. **Email mock not called**: check that `tests/setup.ts` imports `./mocks/email.mock` — the side effect of the import is what activates the mock.
5. **App tries to start the server**: confirm Task 1 was completed (the `if (process.env.NODE_ENV !== 'test')` guard).

- [ ] **Step 15.4: Run with coverage to confirm reporter wiring**

Run: `npm run test:coverage`
Expected: tests pass and a `coverage/` directory appears with HTML report. Coverage will be near 0% — that's fine, Batch 1 only ships infrastructure plus the smoke test.

- [ ] **Step 15.5: Tear down the test DB**

Run: `npm run test:db:down`
Expected: container is removed.

- [ ] **Step 15.6: User commit checkpoint**

Summary: "Batch 1 complete: Vitest + supertest + Docker Mongo + rich seed + helpers + smoke test (3 cases) all green. Foundation ready for Batch 2 (service unit tests)."

---

## Batch 1 — Verification Checklist

Run all of the following from `BackEnd/`:
- [ ] `npm run type-check` → passes.
- [ ] `npm run test:db:up` → container up; port 27018 reachable.
- [ ] `npm test` → smoke test passes (3 cases green).
- [ ] `npm run test:coverage` → produces an HTML report.
- [ ] `npm run test:db:down` → container gone.
- [ ] `npm run dev` → backend boots normally (proves Task 1's guard didn't break dev).
- [ ] `git status` → only the files listed in "File Structure" are modified or added.

---

## Out of Scope for Batch 1 (covered in later batches)

- Service unit tests (Batch 2).
- Route integration tests for endpoints other than `/api/auth/register` (Batch 3).
- Middleware tests (Batch 3).
- Scheduler tests (Batch 4).
- Frontend tests (Batches 5-7).
- E2E (Batch 8).

When Batch 1 lands, ask for the Batch 2 plan.
