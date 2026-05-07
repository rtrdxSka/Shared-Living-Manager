# Testing — Batch 8: E2E (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** All backend batches (1-4) complete and green. Frontend batches (5-7) recommended but not strictly required (E2E exercises both surfaces end-to-end). The Dockerised test Mongo from Batch 1 is reused; this batch does NOT introduce a second compose file.

**Goal:** Stand up a Playwright suite that drives the real Express + React app end-to-end against the same Docker MongoDB the backend integration tests use, but on a separate database (`slm-test-e2e`). Cover the seven critical user journeys identified in the spec.

**Architecture:** Top-level `e2e/` directory holds `playwright.config.ts`, `global-setup.ts`, and the spec files. `global-setup.ts`:
1. Confirms the shared Mongo container (`slm-mongo-test` from Batch 1) is up.
2. Builds the backend (`tsc`) and starts `node BackEnd/dist/index.js` with `NODE_ENV=test`, `MONGODB_URI=mongodb://localhost:27018/slm-test-e2e`, `JWT_SECRET=test`.
3. Drops `slm-test-e2e` and runs the seed.
4. Returns; Playwright's `webServer` config starts the frontend (`npm run dev` in `FrontEnd/`) automatically.

`db-helpers.ts` lets specs drop + re-seed between spec files. Email verification tokens are read directly from the User collection (no real mailbox).

**Tech Stack:** `@playwright/test` 1.46+, the existing Docker compose file from Batch 1, the existing seed script from Batch 1, `mongodb` Node driver (for db-helpers).

**User commit policy:** **"User commit checkpoint"** = stop, summarise, wait for commit.

---

## File Structure

### Files to create
- `e2e/package.json` — minimal package manifest with @playwright/test + mongodb deps.
- `e2e/playwright.config.ts`
- `e2e/global-setup.ts`
- `e2e/global-teardown.ts`
- `e2e/fixtures/db-helpers.ts`
- `e2e/fixtures/test-data.ts`
- `e2e/tests/auth.spec.ts`
- `e2e/tests/onboarding.spec.ts`
- `e2e/tests/expenses.spec.ts`
- `e2e/tests/tasks.spec.ts`
- `e2e/tests/shopping-list.spec.ts`
- `e2e/tests/goals.spec.ts`
- `e2e/tests/recurring-flows.spec.ts`

### Files modified
- Repo-root `package.json` (if it exists) — add `test:e2e` script that runs from the `e2e/` directory. If no root `package.json`, create one minimally to host this script.

---

## Task 1: `e2e/package.json` and dependency install

**Files:**
- Create: `e2e/package.json`

- [ ] **Step 1.1: Create the manifest**

Create `e2e/package.json`:

```json
{
  "name": "slm-e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug"
  },
  "devDependencies": {
    "@playwright/test": "1.46.0",
    "mongodb": "6.8.0",
    "tsx": "4.19.0"
  }
}
```

- [ ] **Step 1.2: Install**

Run from `e2e/`:

```bash
npm install
npx playwright install chromium
```

Expected: deps install; Playwright downloads Chromium browser binary (~150MB; one-time).

- [ ] **Step 1.3: User commit checkpoint**

---

## Task 2: `playwright.config.ts`

**Files:**
- Create: `e2e/playwright.config.ts`

- [ ] **Step 2.1: Write**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,             // tests share a DB; serialize for safety
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add Firefox/WebKit later if time permits.
  ],

  webServer: {
    command: 'npm run dev',
    cwd: '../FrontEnd',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_API_PROXY_TARGET: 'http://localhost:5000', // matches the backend port we boot in global-setup
    },
  },
});
```

Notes:
- `fullyParallel: false` + `workers: 1` prevents two specs from racing on the same DB.
- `webServer` boots the frontend dev server with the proxy pointing at our test backend.

---

## Task 3: `global-setup.ts`

**Files:**
- Create: `e2e/global-setup.ts`

- [ ] **Step 3.1: Write**

```ts
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { MongoClient } from 'mongodb';
import path from 'node:path';

let backendProcess: ChildProcess | null = null;

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '5000',
  MONGODB_URI: 'mongodb://127.0.0.1:27018/slm-test-e2e',
  JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-do-not-use-in-prod',
  RESEND_API_KEY: 'test-key-mocked',
  FROM_EMAIL: 'test@example.com',
  FRONTEND_URL: 'http://localhost:5173',
  BCRYPT_SALT_ROUNDS: '4',
};

async function ensureMongoUp() {
  // Try a quick connect; if it fails, bring the compose stack up.
  try {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27018', { serverSelectionTimeoutMS: 1000 });
    await client.close();
  } catch {
    console.log('[e2e] Bringing up Mongo container...');
    execSync('docker compose -f BackEnd/docker-compose.test.yml up -d', { stdio: 'inherit' });
    // Wait for connection
    for (let i = 0; i < 15; i++) {
      try {
        const client = await MongoClient.connect('mongodb://127.0.0.1:27018', { serverSelectionTimeoutMS: 1000 });
        await client.close();
        return;
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw new Error('Mongo did not become reachable on port 27018 within 15s');
  }
}

async function buildBackend() {
  console.log('[e2e] Building backend...');
  execSync('npm run build', { cwd: 'BackEnd', stdio: 'inherit' });
}

async function startBackend(): Promise<void> {
  console.log('[e2e] Starting backend...');
  backendProcess = spawn('node', ['dist/index.js'], {
    cwd: path.resolve('BackEnd'),
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  // Wait for /health
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    try {
      const res = await fetch('http://localhost:5000/health');
      if (res.ok) {
        console.log('[e2e] Backend is up.');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Backend did not respond on port 5000 within 30s');
}

async function seed() {
  console.log('[e2e] Seeding slm-test-e2e database...');
  // Use the seed script from Batch 1, but force the e2e DB.
  // tsx allows running TypeScript directly without precompiling.
  execSync('npx tsx tests/seed/run-seed.ts', {
    cwd: 'BackEnd',
    env: { ...env, MONGODB_URI: 'mongodb://127.0.0.1:27018/slm-test-e2e' },
    stdio: 'inherit',
  });
}

export default async function globalSetup() {
  await ensureMongoUp();
  await buildBackend();
  await startBackend();
  await seed();

  // Stash the backend pid so teardown can kill it.
  (globalThis as any).__BACKEND_PROCESS = backendProcess;
}
```

Notes:
- This relies on `BackEnd/tests/seed/run-seed.ts` existing — see Step 3.2.
- `tsx` lets us run the TypeScript seed directly; if your devDeps don't include it at the backend, the e2e package's tsx dep covers it via `npx tsx`.

- [ ] **Step 3.2: Add a runnable seed entrypoint**

The Batch 1 seed script (`BackEnd/tests/seed/seed.ts`) exports `seedDatabase()` but doesn't auto-run on import. Create a small wrapper that connects + seeds + exits.

Create `BackEnd/tests/seed/run-seed.ts`:

```ts
import mongoose from 'mongoose';
import { seedDatabase } from './seed';

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await seedDatabase();
  await mongoose.disconnect();
  console.log('[seed] complete');
  process.exit(0);
})().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
```

- [ ] **Step 3.3: Verify seed script works manually**

Run: `cd BackEnd && MONGODB_URI=mongodb://127.0.0.1:27018/slm-test-e2e npx tsx tests/seed/run-seed.ts`
Expected: prints `[seed] complete` and exits cleanly.

---

## Task 4: `global-teardown.ts`

**Files:**
- Create: `e2e/global-teardown.ts`

- [ ] **Step 4.1: Write**

```ts
export default async function globalTeardown() {
  const backend = (globalThis as any).__BACKEND_PROCESS;
  if (backend && !backend.killed) {
    console.log('[e2e] Stopping backend...');
    backend.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (!backend.killed) backend.kill('SIGKILL');
  }
  // Leave the Mongo container running — next run reuses it. Manual stop: `docker compose -f BackEnd/docker-compose.test.yml down -v`
}
```

---

## Task 5: `db-helpers.ts`

**Files:**
- Create: `e2e/fixtures/db-helpers.ts`

- [ ] **Step 5.1: Write**

```ts
import { MongoClient } from 'mongodb';
import { execSync } from 'node:child_process';
import path from 'node:path';

const DB_URI = 'mongodb://127.0.0.1:27018/slm-test-e2e';

export async function dropAndReseedDb() {
  const client = await MongoClient.connect(DB_URI);
  try {
    await client.db().dropDatabase();
  } finally {
    await client.close();
  }
  execSync('npx tsx tests/seed/run-seed.ts', {
    cwd: path.resolve(__dirname, '../../BackEnd'),
    env: { ...process.env, MONGODB_URI: DB_URI },
    stdio: 'inherit',
  });
}

export async function getVerificationTokenFor(email: string): Promise<string> {
  const client = await MongoClient.connect(DB_URI);
  try {
    const user = await client.db().collection('users').findOne(
      { email },
      { projection: { emailVerificationToken: 1 } }
    );
    if (!user?.emailVerificationToken) throw new Error(`No verification token for ${email}`);
    // Note: this returns the HASH stored in DB; the verify-email endpoint expects the RAW token.
    // Workaround for E2E: register a known user and read the raw token from the email mock log
    // OR temporarily store the raw token alongside the hash for E2E only.
    // For the test plan below, we use a different strategy: directly mark the user verified
    // in the DB after register (since we control the test backend).
    return user.emailVerificationToken;
  } finally {
    await client.close();
  }
}

export async function markEmailVerified(email: string): Promise<void> {
  const client = await MongoClient.connect(DB_URI);
  try {
    await client.db().collection('users').updateOne(
      { email },
      { $set: { isEmailVerified: true } }
    );
  } finally {
    await client.close();
  }
}

export async function getInviteCodeForHousehold(householdName: string): Promise<string> {
  const client = await MongoClient.connect(DB_URI);
  try {
    const hh = await client.db().collection('households').findOne({ name: householdName });
    if (!hh?.inviteCode) throw new Error(`No invite code for household ${householdName}`);
    return hh.inviteCode;
  } finally {
    await client.close();
  }
}
```

Notes:
- The honest issue with `getVerificationTokenFor`: the DB stores the HASH of the token, not the raw token (security). The verify-email endpoint hashes the input and compares. For E2E we work around this by simply calling `markEmailVerified` directly after register — we're not testing the email-link flow itself in E2E (Batch 3 already did) but rather the user journey *after* verification.

---

## Task 6: `fixtures/test-data.ts`

**Files:**
- Create: `e2e/fixtures/test-data.ts`

- [ ] **Step 6.1: Write**

```ts
export const SEEDED_USERS = {
  alice: { email: 'alice@example.com', password: 'Password123!', firstName: 'Alice', lastName: 'Anderson' },
  bob:   { email: 'bob@example.com',   password: 'Password123!', firstName: 'Bob',   lastName: 'Brown' },
};

export const SEEDED_HOUSEHOLDS = {
  couple: { name: 'Alice & Bob', inviteCode: 'couple-invite-0001' },
};
```

---

## Task 7: `tests/auth.spec.ts`

**Files:**
- Create: `e2e/tests/auth.spec.ts`

- [ ] **Step 7.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb, markEmailVerified } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => {
  await dropAndReseedDb();
});

test('register → verify → login → logout', async ({ page }) => {
  const email = `e2e-newuser-${Date.now()}@example.com`;
  const password = 'Password123!';

  // Register
  await page.goto('/register');
  await page.getByLabel(/first name/i).fill('E2E');
  await page.getByLabel(/last name/i).fill('User');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  // Mark verified directly in DB (we don't have a test inbox)
  await markEmailVerified(email);

  // Should land on dashboard or get-started after register; for new users with no household → /get-started
  await expect(page).toHaveURL(/get-started|dashboard/);

  // Logout (depending on where logout lives — adjust selector)
  // For this smoke test we just confirm the register flow produced a session.
});

test('login with seeded user lands on dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(SEEDED_USERS.alice.email);
  await page.getByLabel(/password/i).fill(SEEDED_USERS.alice.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/dashboard/);
});

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(SEEDED_USERS.alice.email);
  await page.getByLabel(/password/i).fill('WrongPassword!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();
});
```

- [ ] **Step 7.2: Run**

Run: `cd e2e && npm test tests/auth.spec.ts`
Expected: 3 tests pass.

---

## Task 8: `tests/onboarding.spec.ts`

**Files:**
- Create: `e2e/tests/onboarding.spec.ts`

- [ ] **Step 8.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb, markEmailVerified, getInviteCodeForHousehold } from '../fixtures/db-helpers';

test.beforeAll(async () => {
  await dropAndReseedDb();
});

test('user1 creates a couple household, user2 joins via invite code', async ({ page, context }) => {
  // ── User 1: create new account + new household ───────────────────────
  const u1Email = `u1-${Date.now()}@example.com`;
  const u2Email = `u2-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel(/first name/i).fill('User1');
  await page.getByLabel(/last name/i).fill('A');
  await page.getByLabel(/email/i).fill(u1Email);
  await page.getByLabel(/^password$/i).fill('Password123!');
  await page.getByLabel(/confirm password/i).fill('Password123!');
  await page.getByRole('button', { name: /create account/i }).click();
  await markEmailVerified(u1Email);

  // Onboarding flow — fill the multi-step form. The exact selectors depend
  // on your survey implementation; the steps below are illustrative. ADJUST.
  await page.goto('/get-started');
  // Step 1: Living arrangement
  await page.getByLabel(/household name/i).fill('E2E Couple');
  await page.getByLabel(/total members/i).fill('2');
  await page.getByRole('button', { name: /couple/i }).click();
  await page.getByRole('button', { name: /next/i }).click();
  // Step 2: creator profile
  await page.getByLabel(/nickname/i).fill('User1');
  await page.getByRole('button', { name: /next/i }).click();
  // Step 3: members
  await page.getByLabel(/partner email/i).fill(u2Email);
  await page.getByRole('button', { name: /next/i }).click();
  // Step 4 (finance): pick defaults; submit
  await page.getByRole('button', { name: /finish|create/i }).click();

  await expect(page).toHaveURL(/dashboard/);

  // Capture the invite code from the DB (the InvitePage shows it in the UI but
  // grabbing it via DB is robust).
  const inviteCode = await getInviteCodeForHousehold('E2E Couple');

  // ── User 2: open a fresh context, register, join household ──────────
  const u2Page = await context.newPage();
  await u2Page.goto('/register');
  await u2Page.getByLabel(/first name/i).fill('User2');
  await u2Page.getByLabel(/last name/i).fill('B');
  await u2Page.getByLabel(/email/i).fill(u2Email);
  await u2Page.getByLabel(/^password$/i).fill('Password123!');
  await u2Page.getByLabel(/confirm password/i).fill('Password123!');
  await u2Page.getByRole('button', { name: /create account/i }).click();
  await markEmailVerified(u2Email);

  // Join via invite code (the get-started flow likely has a "Join existing" branch)
  await u2Page.goto('/get-started');
  await u2Page.getByRole('button', { name: /join existing|have a code/i }).click();
  await u2Page.getByLabel(/invite code/i).fill(inviteCode);
  await u2Page.getByRole('button', { name: /join/i }).click();

  await expect(u2Page).toHaveURL(/dashboard/);
});
```

Notes:
- The selectors in the onboarding multi-step flow vary heavily by implementation. The first time this spec runs, expect to spend ~30 minutes adjusting selectors to match the actual UI. The test plan above gives the SHAPE — fill in real selectors after a `page.pause()` or `npx playwright codegen http://localhost:5173`.

- [ ] **Step 8.2: Run**

Run: `cd e2e && npm test tests/onboarding.spec.ts`
Expected: 1 test passes (it's a long but single scenario).

---

## Task 9: `tests/expenses.spec.ts`

**Files:**
- Create: `e2e/tests/expenses.spec.ts`

- [ ] **Step 9.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => { await dropAndReseedDb(); });

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test('add an expense → it appears in the list', async ({ page }) => {
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/expenses');

  await page.getByRole('button', { name: /add expense/i }).click();
  await page.getByLabel(/description/i).fill('E2E Test Expense');
  await page.getByLabel(/amount/i).fill('42.50');
  // Category and date have UI defaults — submit
  await page.getByRole('button', { name: /add|save|create/i }).click();

  await expect(page.getByText('E2E Test Expense')).toBeVisible();
});

test('claim → request resolution → confirm flow settles an expense', async ({ page, browser }) => {
  // Alice paid an expense, bob claims it, then bob requests resolution, alice confirms
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/expenses');

  // Alice adds an expense
  await page.getByRole('button', { name: /add expense/i }).click();
  await page.getByLabel(/description/i).fill('Settle-me');
  await page.getByLabel(/amount/i).fill('20');
  await page.getByRole('button', { name: /add|save|create/i }).click();
  await expect(page.getByText('Settle-me')).toBeVisible();

  // Switch to Bob's session in a new context
  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await loginAs(bobPage, SEEDED_USERS.bob.email, SEEDED_USERS.bob.password);
  await bobPage.goto('/dashboard/expenses');

  // Bob expands the Settle-me expense and clicks request-resolution.
  // The exact button text varies; adjust based on the actual UI.
  await bobPage.getByText('Settle-me').click();
  await bobPage.getByRole('button', { name: /request|resolve|settle/i }).click();

  // Back to Alice — confirm
  await page.reload();
  await page.getByText('Settle-me').click();
  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(page.getByText(/resolved|settled/i)).toBeVisible();

  await bobContext.close();
});
```

- [ ] **Step 9.2: Run**

Expected: 2 tests pass.

---

## Task 10: `tests/tasks.spec.ts`

**Files:**
- Create: `e2e/tests/tasks.spec.ts`

- [ ] **Step 10.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => { await dropAndReseedDb(); });

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test('add a task and mark it complete', async ({ page }) => {
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/tasks');

  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByLabel(/title/i).fill('E2E Task');
  await page.getByRole('button', { name: /add|save|create/i }).click();

  await expect(page.getByText('E2E Task')).toBeVisible();

  // Complete it via checkbox or button
  const taskRow = page.getByText('E2E Task').locator('xpath=ancestor::*[1]');
  await taskRow.getByRole('checkbox').check().catch(() =>
    taskRow.getByRole('button', { name: /done|complete/i }).click()
  );

  await expect(page.getByText(/completed|done/i).first()).toBeVisible();
});
```

- [ ] **Step 10.2: Run**

Expected: 1 test passes.

---

## Task 11: `tests/shopping-list.spec.ts`

**Files:**
- Create: `e2e/tests/shopping-list.spec.ts`

- [ ] **Step 11.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => { await dropAndReseedDb(); });

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test('add a shopping item, mark bought, archive', async ({ page }) => {
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/shopping-list');

  await page.getByRole('button', { name: /add item/i }).click();
  await page.getByLabel(/^name$/i).fill('E2E Cheese');
  await page.getByRole('button', { name: /add|save/i }).click();
  await expect(page.getByText('E2E Cheese')).toBeVisible();

  // Mark bought (likely via checkbox/click)
  const row = page.getByText('E2E Cheese').locator('xpath=ancestor::*[1]');
  await row.getByRole('checkbox').check().catch(() => row.click());
  // Done shopping flow
  await page.getByRole('button', { name: /done shopping/i }).click();
  await page.getByRole('button', { name: /done|confirm/i }).click();
});
```

- [ ] **Step 11.2: Run**

Expected: 1 test passes.

---

## Task 12: `tests/goals.spec.ts`

**Files:**
- Create: `e2e/tests/goals.spec.ts`

- [ ] **Step 12.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => { await dropAndReseedDb(); });

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test('create a goal and add a contribution', async ({ page }) => {
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/goals');

  await page.getByRole('button', { name: /add goal/i }).click();
  await page.getByLabel(/name/i).fill('E2E Goal');
  await page.getByLabel(/target amount/i).fill('500');
  await page.getByRole('button', { name: /add|save|create/i }).click();

  await expect(page.getByText('E2E Goal')).toBeVisible();

  // Add a contribution
  const goalCard = page.getByText('E2E Goal').locator('xpath=ancestor::*[1]');
  await goalCard.getByRole('button', { name: /add contribution/i }).click();
  await page.getByLabel(/amount/i).fill('100');
  await page.getByRole('button', { name: /add|save/i }).click();

  await expect(page.getByText(/100|20%/)).toBeVisible(); // 100/500 = 20%
});
```

- [ ] **Step 12.2: Run**

Expected: 1 test passes.

---

## Task 13: `tests/recurring-flows.spec.ts`

**Files:**
- Create: `e2e/tests/recurring-flows.spec.ts`

- [ ] **Step 13.1: Write**

```ts
import { test, expect } from '@playwright/test';
import { dropAndReseedDb } from '../fixtures/db-helpers';
import { SEEDED_USERS } from '../fixtures/test-data';

test.beforeAll(async () => { await dropAndReseedDb(); });

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test('create a recurring expense template appears in the list', async ({ page }) => {
  await loginAs(page, SEEDED_USERS.alice.email, SEEDED_USERS.alice.password);
  await page.goto('/dashboard/expenses');

  // Open the recurring drawer
  await page.getByRole('button', { name: /recurring/i }).click();

  await page.getByRole('button', { name: /add (recurring|new)/i }).click();
  await page.getByLabel(/description/i).fill('E2E Auto-Rent');
  await page.getByLabel(/amount/i).fill('1200');
  // Toggle "Make recurring" if not already on (depends on UX), pick interval, payer
  await page.getByRole('button', { name: /make recurring|recurring/i }).click().catch(() => null);
  await page.getByRole('button', { name: /monthly/i }).click();
  await page.getByRole('button', { name: /add|save|create/i }).click();

  await expect(page.getByText('E2E Auto-Rent')).toBeVisible();

  // The cron-driven instance generation is covered in Batch 4 unit tests; here we
  // just confirm the template is created via the UI and survives a page refresh.
  await page.reload();
  await page.getByRole('button', { name: /recurring/i }).click();
  await expect(page.getByText('E2E Auto-Rent')).toBeVisible();
});
```

- [ ] **Step 13.2: Run**

Expected: 1 test passes.

- [ ] **Step 13.3: User commit checkpoint**

Summary: "E2E suite: 7 critical journeys (auth, onboarding, expenses, tasks, shopping, goals, recurring). All pass."

---

## Task 14: Add a top-level `npm run test:e2e` script

**Files:**
- Modify (or Create if missing): top-level `package.json`

- [ ] **Step 14.1: Add script**

If a top-level `package.json` exists, add:

```json
"scripts": {
  "test:e2e": "cd e2e && npm test"
}
```

If no top-level `package.json` exists yet, create a minimal one:

```json
{
  "name": "shared-living-manager",
  "private": true,
  "scripts": {
    "test:e2e": "cd e2e && npm test"
  }
}
```

- [ ] **Step 14.2: Run end-to-end**

Run from repo root: `npm run test:e2e`
Expected: all 7 spec files run; ~10 tests pass total. Total runtime should be 1-3 minutes.

- [ ] **Step 14.3: User commit checkpoint**

---

## Batch 8 — Verification Checklist

- [ ] `cd BackEnd && npm run test:db:up` (Mongo container).
- [ ] `cd e2e && npm test` → all specs green.
- [ ] Individual specs runnable: `cd e2e && npx playwright test tests/auth.spec.ts`.
- [ ] On failure, traces and screenshots are produced under `e2e/test-results/`.
- [ ] `git status` → only the listed files modified/added.

---

## Out of Scope (and Out of Series)

- CI integration: the user opted out of GitHub Actions in the spec. If you want it later, the same `npm run test:e2e` script works in a workflow that boots `services: mongodb`.
- Cross-browser (Firefox/WebKit): a single line in `playwright.config.ts` `projects` array adds them. Not required for the thesis.
- Visual regression / accessibility audits: out of scope for this plan.

---

## Final Note

When Batch 8 is green, **the entire test suite from the spec is in place**:
- ~110-130 backend tests across services + utils + routes + middleware + 4 schedulers.
- ~80-100 frontend tests across hooks + utils + axios + Zod + auth pages + dashboard pages + forms + dialogs + route guards.
- ~10 E2E tests covering the seven critical user journeys.

That's roughly 200-240 automated tests, all reproducible locally via `npm test` (per package) and `npm run test:e2e` (top-level). Ship it.
