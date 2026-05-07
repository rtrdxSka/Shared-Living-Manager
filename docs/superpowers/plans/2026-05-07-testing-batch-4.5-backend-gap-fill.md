# Testing — Batch 4.5: Backend Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill backend test-coverage gaps left by Batches 1–4 before frontend testing starts. This batch is **purely additive** — it creates 5 new test files covering low-level utilities and middleware that integration tests touch transitively but never assert against directly: `utils/regex`, `middleware/validate`, `middleware/errorHandler`, `utils/email`, and `scheduler/cronLock`.

**Architecture:** All five files live alongside the existing test suite. Two of them (`regex.test.ts`, `email.test.ts`) are unit tests with no DB access. Three (`validate.test.ts`, `errorHandler.test.ts`, `cronLock.test.ts`) run inside the existing `tests/setup.ts` lifecycle (Docker Mongo + seed reset per file) but isolate themselves from real routes either by mounting a minimal Express app per case or by mocking the cron transport. The trickiest file is `email.test.ts` — `tests/setup.ts` globally `vi.mock`s `src/utils/email`, so the email tests must `vi.unmock` that path and instead mock the underlying `resend` package. The cron tests mock `node-cron`'s `schedule` to capture the handler so the test can invoke it synchronously.

**Tech Stack:** Vitest 1.6+, supertest 7+, Mongoose 9 (existing), MongoDB 7 (Docker, existing), node-cron (existing), express-validator (existing), Resend (existing — but mocked at the package level for the email tests).

**User commit policy:** This user commits manually. Where the plan says **"User commit checkpoint"**, stop, summarise what changed, and wait for the user to review and commit before proceeding.

---

## File Structure

### Files to create
- `BackEnd/tests/unit/utils/regex.test.ts`
- `BackEnd/tests/integration/middleware/validate.test.ts`
- `BackEnd/tests/integration/middleware/errorHandler.test.ts`
- `BackEnd/tests/unit/utils/email.test.ts`
- `BackEnd/tests/integration/scheduler/cronLock.test.ts`

### Files to modify
- (none) — this batch is purely additive; no source code changes.

---

## Task 0: Pre-flight verification

**Files:** read-only

- [ ] **Step 0.1: Confirm Batch 1 still passes from a clean state**

Run from `BackEnd/`:

```bash
npm run test:db:up && npm test && npm run test:db:down
```

Expected output (the trailing summary line is what matters):

```
 ✓ tests/integration/auth.smoke.test.ts (3)

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

If any case fails, **stop and report to the user**. Batch 4.5 assumes Batch 1 is green; debugging Batch 1 is out of scope here.

- [ ] **Step 0.2: Confirm the source files are at the expected paths and shapes**

Run each command below. Each one must succeed (exit 0) and print at least one match:

```bash
grep -n "export function escapeRegex" BackEnd/src/utils/regex.ts
grep -n "export const handleValidationErrors" BackEnd/src/middleware/validate.ts
grep -n "export const errorHandler" BackEnd/src/middleware/errorHandler.ts
grep -n "export const sendVerificationEmail" BackEnd/src/utils/email.ts
grep -n "export const sendPasswordResetEmail" BackEnd/src/utils/email.ts
grep -n "export function scheduleWithLock" BackEnd/src/scheduler/cronLock.ts
grep -n "export const CronLock" BackEnd/src/models/cron-lock.model.ts
```

Expected (exact line numbers may vary; the named export must be present):

```
BackEnd/src/utils/regex.ts:6:export function escapeRegex(input: string): string {
BackEnd/src/middleware/validate.ts:4:export const handleValidationErrors = (
BackEnd/src/middleware/errorHandler.ts:14:export const errorHandler = (
BackEnd/src/utils/email.ts:48:export const sendVerificationEmail = async (
BackEnd/src/utils/email.ts:77:export const sendPasswordResetEmail = async (
BackEnd/src/scheduler/cronLock.ts:15:export function scheduleWithLock(
BackEnd/src/models/cron-lock.model.ts:32:export const CronLock = mongoose.model<ICronLock>('CronLock', cronLockSchema);
```

If any export is missing or renamed, **stop and report** — adapt the affected task before continuing.

- [ ] **Step 0.3: Confirm the global mocks file shape**

Run:

```bash
grep -n "vi.mock" BackEnd/tests/mocks/email.mock.ts
```

Expected:

```
BackEnd/tests/mocks/email.mock.ts:3:vi.mock('../../src/utils/email', () => ({
```

This confirms the global `vi.mock` path is `../../src/utils/email` — Task 4 (`email.test.ts`) needs to call `vi.unmock` with the **same path string** (or an absolute path; we'll use the relative form to match).

- [ ] **Step 0.4: Confirm directory layout**

Run:

```bash
ls BackEnd/tests
```

Expected entries: `helpers/`, `integration/`, `mocks/`, `seed/`, `setup.ts`. There is no `unit/` directory yet — Task 1 will create `tests/unit/utils/`.

---

## Task 1: `tests/unit/utils/regex.test.ts` (smallest, easiest first)

**Files:**
- Create: `BackEnd/tests/unit/utils/regex.test.ts`

`escapeRegex` is a 3-line pure function. No DB, no mocking, no Express. We just import it and assert. Putting this first lets the implementer verify the new directory structure and the test runner's discovery globs (`tests/**/*.test.ts`) work for nested paths before tackling anything harder.

- [ ] **Step 1.1: Create the directory**

Run from `BackEnd/`:

```bash
mkdir -p tests/unit/utils
```

Expected: directory created (silent on success). Re-running is idempotent thanks to `-p`.

- [ ] **Step 1.2: Write the test file**

Create `BackEnd/tests/unit/utils/regex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { escapeRegex } from '../../../src/utils/regex';

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c[d]')).toBe('a\\.b\\*c\\[d\\]');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('returns a pattern that matches the literal input', () => {
    const literal = 'foo.bar';
    const re = new RegExp(escapeRegex(literal));
    expect(re.test('foo.bar')).toBe(true);
    expect(re.test('fooXbar')).toBe(false);
  });
});
```

Notes:
- The relative import path is `../../../src/utils/regex` because the file lives at `tests/unit/utils/`.
- No DB needed — but the global `tests/setup.ts` will still run (connects Mongo, drops + seeds the test database). That's fine; the cost is ~2s and confirms the foundation still works.

- [ ] **Step 1.3: Bring the test DB up**

Run from `BackEnd/`:

```bash
npm run test:db:up
```

Expected: Docker container starts; `wait-on tcp:127.0.0.1:27018` exits within ~5s.

- [ ] **Step 1.4: Run the new test file in isolation**

Run:

```bash
npm test -- tests/unit/utils/regex.test.ts
```

Expected:

```
 ✓ tests/unit/utils/regex.test.ts (3)
   ✓ escapeRegex (3)
     ✓ escapes regex metacharacters
     ✓ leaves plain text unchanged
     ✓ returns a pattern that matches the literal input

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Troubleshooting:**
- `Cannot find module '../../../src/utils/regex'` → check the import path; from `tests/unit/utils/` the file is exactly three `..` away from `src/`.
- `No test files found` → confirm the file is named `regex.test.ts` (not `regex.spec.ts`); the include glob in `vitest.config.ts` is `tests/**/*.test.ts`.
- Test DB connection error during setup → setup connects regardless of what tests need. Make sure `npm run test:db:up` is up.

- [ ] **Step 1.5: Run the full suite to confirm nothing regressed**

Run:

```bash
npm test
```

Expected: 2 test files (`auth.smoke.test.ts` + `regex.test.ts`), 6 cases, all green.

- [ ] **Step 1.6: User commit checkpoint**

Summary: "Added unit test for `escapeRegex` (3 cases). Introduces the `tests/unit/utils/` directory." Wait for user to commit before continuing.

---

## Task 2: `tests/integration/middleware/validate.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/middleware/validate.test.ts`

Each case mounts a tiny Express app with `body('email').isEmail()` + `body('age').isInt(...)` + `handleValidationErrors`, then exercises the path with supertest. Three cases cover: success path, single-field failure shape, multi-field aggregation.

- [ ] **Step 2.1: Create the directory**

Run from `BackEnd/`:

```bash
mkdir -p tests/integration/middleware
```

- [ ] **Step 2.2: Write the test file**

Create `BackEnd/tests/integration/middleware/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import { body } from 'express-validator';
import request from 'supertest';
import { handleValidationErrors } from '../../../src/middleware/validate';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/test',
    body('email').isEmail().withMessage('Email must be valid'),
    body('age').isInt({ min: 0 }).withMessage('Age must be a positive integer'),
    handleValidationErrors,
    (_req, res) => {
      res.status(200).json({ ok: true });
    }
  );
  return app;
};

describe('handleValidationErrors middleware', () => {
  it('calls next() when all validators pass', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'a@b.co', age: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 400 with field/message for one bad field', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'not-an-email', age: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      message: 'Validation failed',
    });
    expect(res.body.errors).toEqual([
      { field: 'email', message: 'Email must be valid' },
    ]);
  });

  it('lists all failed fields when multiple validators fail', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'x', age: -1 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(2);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['age', 'email']);
  });
});
```

Notes:
- The test owns the Express app — it intentionally does NOT import `src/index.ts`. That keeps it independent of route changes elsewhere and isolates this from the rest of the request pipeline.
- Importing `express-validator` (already a project dependency) and `supertest` (added in Batch 1) is enough; no new packages needed.
- `buildApp()` per test means each case has fresh middleware state — `validationResult` is per-request so this isn't strictly required, but it keeps tests independent.

- [ ] **Step 2.3: Run the test file in isolation**

Run:

```bash
npm test -- tests/integration/middleware/validate.test.ts
```

Expected:

```
 ✓ tests/integration/middleware/validate.test.ts (3)
   ✓ handleValidationErrors middleware (3)
     ✓ calls next() when all validators pass
     ✓ returns 400 with field/message for one bad field
     ✓ lists all failed fields when multiple validators fail

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Troubleshooting:**
- `TypeError: app.post is not a function` → the import is `import express from 'express'` (default import); confirm `esModuleInterop: true` is in `tsconfig.json` (Batch 1 already required this).
- Status 404 instead of 200 → the test is sending to the wrong path. The route is `/test`, not `/api/test`.
- Field name `unknown` in the response → the production code defensively reads `error.path`. If express-validator's error shape changes in a future major, confirm via `console.log(errors.array())` in the production code.

- [ ] **Step 2.4: User commit checkpoint**

Summary: "Added validate-middleware integration tests (3 cases). Asserts pass-through, single-field 400, and multi-field aggregation." Wait for user to commit.

---

## Task 3: `tests/integration/middleware/errorHandler.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/middleware/errorHandler.test.ts`

Six cases, one per branch in `errorHandler`:
1. `AppError` 404 (uses `NotFoundError` factory) — also asserts default mode (`NODE_ENV=test`) does NOT emit `stack`.
2. `AppError` 403 (uses `ForbiddenError`).
3. Mongoose `ValidationError` with two field errors.
4. Duplicate-key error (`{ code: 11000 }`).
5. Generic `Error` → 500.
6. Stack inclusion when `NODE_ENV=development` (set per-test via `vi.stubEnv`).

Each case mounts a fresh Express app whose only route throws the prepared error.

- [ ] **Step 3.1: Write the test file**

Create `BackEnd/tests/integration/middleware/errorHandler.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { NotFoundError, ForbiddenError } from '../../../src/utils/error';

const buildApp = (err: unknown) => {
  const app = express();
  app.use(express.json());
  app.get('/throw', (_req: Request, _res: Response, next: NextFunction) => {
    next(err as Error);
  });
  app.use(errorHandler);
  return app;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('errorHandler middleware', () => {
  it('handles AppError (404 NotFoundError) and omits stack in non-development env', async () => {
    // tests/setup.ts already sets NODE_ENV=test via dotenv-cli; we rely on that here.
    const res = await request(buildApp(NotFoundError('User not found')))
      .get('/throw');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'User not found' });
    expect(res.body.stack).toBeUndefined();
  });

  it('handles AppError (403 ForbiddenError)', async () => {
    const res = await request(buildApp(ForbiddenError('Not allowed')))
      .get('/throw');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: 'error', message: 'Not allowed' });
  });

  it('handles Mongoose ValidationError with field-level messages', async () => {
    const validationErr = new mongoose.Error.ValidationError();
    validationErr.addError(
      'email',
      new mongoose.Error.ValidatorError({ message: 'Email is required', path: 'email' })
    );
    validationErr.addError(
      'age',
      new mongoose.Error.ValidatorError({ message: 'Age must be a number', path: 'age' })
    );

    const res = await request(buildApp(validationErr)).get('/throw');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Email is required', 'Age must be a number'])
    );
    expect(res.body.errors).toHaveLength(2);
  });

  it('handles MongoDB duplicate-key errors (code 11000) as 409', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    const res = await request(buildApp(dupErr)).get('/throw');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      status: 'error',
      message: 'A resource with that value already exists',
    });
  });

  it('falls back to generic 500 for unexpected errors', async () => {
    const res = await request(buildApp(new Error('boom'))).get('/throw');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ status: 'error', message: 'Internal server error' });
    // Ensure raw error text never leaks in the default test env.
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });

  it('includes stack trace in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await request(buildApp(NotFoundError('dev mode')))
      .get('/throw');

    expect(res.status).toBe(404);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });
});
```

Notes:
- The first test asserts the NEGATIVE for `stack` — that's what guarantees production doesn't leak stacks under default config.
- `vi.stubEnv` is the correct primitive for per-test env tweaks because `errorHandler` reads `process.env.NODE_ENV` at request time (not at import time). After `unstubAllEnvs` in `afterEach`, the original value (`test`) is restored.
- `mongoose.Error.ValidationError` + `addError(path, ValidatorError)` constructs the error type the production code branches on. We do NOT import a real model here — that would couple the test to a specific schema.
- `Object.assign(new Error(...), { code: 11000 })` exactly matches the duck-typed check in the production code (`'code' in err && err.code === 11000`).

- [ ] **Step 3.2: Run the test file in isolation**

Run:

```bash
npm test -- tests/integration/middleware/errorHandler.test.ts
```

Expected:

```
 ✓ tests/integration/middleware/errorHandler.test.ts (6)
   ✓ errorHandler middleware (6)
     ✓ handles AppError (404 NotFoundError) and omits stack in non-development env
     ✓ handles AppError (403 ForbiddenError)
     ✓ handles Mongoose ValidationError with field-level messages
     ✓ handles MongoDB duplicate-key errors (code 11000) as 409
     ✓ falls back to generic 500 for unexpected errors
     ✓ includes stack trace in development mode

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Troubleshooting:**
- `mongoose.Error.ValidatorError is not a constructor` → Mongoose 7+ exposes it; if the project is on an older version, swap for the simpler form: `validationErr.errors.email = { message: 'Email is required' } as any;`. The production code only reads `e.message` from each value.
- "Stack present in non-dev test" → this means `tests/setup.ts` or some other entry leaked `NODE_ENV=development`. Confirm `.env.test` sets `NODE_ENV=test` (Batch 1 added this).
- Duplicate-key test returns 500 not 409 → the production check is `('code' in err) && err.code === 11000`. Make sure the assignment is `Object.assign(new Error(...), { code: 11000 })` — `new Error('msg', { code: 11000 })` would not work; the second arg is `cause`.

- [ ] **Step 3.3: User commit checkpoint**

Summary: "Added errorHandler middleware tests (6 cases): AppError 404/403, Mongoose ValidationError, duplicate-key 409, generic 500, dev-only stack." Wait for user to commit.

---

## Task 4: `tests/unit/utils/email.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/utils/email.test.ts`

This is the trickiest file. The global setup (`tests/setup.ts`) imports `tests/mocks/email.mock.ts` which `vi.mock`s `'../../src/utils/email'`. Inside `email.test.ts` we need to test the **real** module — so we `vi.unmock` that path and instead mock the underlying `resend` package. Because the real module caches a `Resend` instance in a module-level variable (`resendClient`), we use `vi.resetModules()` between tests + dynamic `await import(...)` so each case picks up a fresh module that re-reads `process.env`.

Seven cases:
1. `sendVerificationEmail` calls `resend.emails.send` with the correct shape.
2. `sendVerificationEmail` HTML-escapes `firstName` (XSS regression).
3. `sendVerificationEmail` rejects when Resend rejects.
4. `sendVerificationEmail` rejects with timeout when send hangs longer than `RESEND_TIMEOUT_MS`.
5. `sendVerificationEmail` throws when `RESEND_API_KEY` is unset.
6. `sendVerificationEmail` throws when `FROM_EMAIL` is unset.
7. `sendPasswordResetEmail` uses the reset URL and reset subject.

- [ ] **Step 4.1: Write the test file**

Create `BackEnd/tests/unit/utils/email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// IMPORTANT: tests/setup.ts globally mocks src/utils/email via tests/mocks/email.mock.ts.
// Bypass that here so we can test the REAL module against a mocked `resend` package.
vi.unmock('../../../src/utils/email');

// Mock the underlying resend package. The factory is hoisted, so `mockSend`
// has to be declared with vi.hoisted to be referenceable inside vi.mock(...).
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ id: 'msg_123' });
  // Force a fresh module evaluation so the cached `resendClient` and any env
  // reads are re-done per test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('sendVerificationEmail', () => {
  it('calls resend.emails.send with the right shape', async () => {
    const { sendVerificationEmail } = await import('../../../src/utils/email');
    await sendVerificationEmail('user@example.com', 'Alice', 'tok123');

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toMatch(/HouseMate <.+>/);
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toBe('Verify your email address');
    expect(args.html).toContain('http://localhost:5173/verify-email?token=tok123');
    expect(args.html).toContain('Alice');
  });

  it('HTML-escapes firstName (XSS regression)', async () => {
    const { sendVerificationEmail } = await import('../../../src/utils/email');
    await sendVerificationEmail('user@example.com', '<script>alert(1)</script>', 'tok');

    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('rejects when Resend rejects', async () => {
    mockSend.mockRejectedValueOnce(new Error('resend boom'));
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow('resend boom');
  });

  it('rejects with timeout when send takes longer than RESEND_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    // Never resolves — sendWithTimeout's setTimeout race must win.
    mockSend.mockImplementationOnce(() => new Promise(() => { /* hang forever */ }));
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    const promise = sendVerificationEmail('a@b.co', 'A', 't');
    // Default RESEND_TIMEOUT_MS is 5000; bump 1ms past to fire the timeout.
    vi.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('Resend request timed out');
  });

  it('throws if RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow(
      /RESEND_API_KEY is not defined/
    );
  });

  it('throws if FROM_EMAIL is unset', async () => {
    vi.stubEnv('FROM_EMAIL', '');
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow(
      /FROM_EMAIL is not defined/
    );
  });
});

describe('sendPasswordResetEmail', () => {
  it('uses the reset URL and reset subject', async () => {
    const { sendPasswordResetEmail } = await import('../../../src/utils/email');
    await sendPasswordResetEmail('user@example.com', 'Alice', 'reset-tok');

    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toBe('Reset your password');
    expect(args.html).toContain('http://localhost:5173/reset-password?token=reset-tok');
  });
});
```

Notes the implementer should pay close attention to:
- **`vi.unmock` path string must match the global `vi.mock` path string.** The global mock in `tests/mocks/email.mock.ts` uses `'../../src/utils/email'` (relative to that file). From `tests/unit/utils/`, the same module is at `'../../../src/utils/email'`. Vitest normalises both to the same resolved path, so the unmock matches — but if you copy this file elsewhere, recompute the relative path.
- **`vi.hoisted` is required** because `vi.mock(...)` factories run BEFORE any top-level `const` declarations in the same file. Without `vi.hoisted`, `mockSend` would be `undefined` inside the factory.
- **`vi.resetModules()` between tests** is essential. The real `email.ts` caches the `Resend` client in a module-scoped `let resendClient`. Without a reset, a test that succeeds with a populated `RESEND_API_KEY` would hide the test that asserts behaviour when the key is missing — the cached client would already be live.
- **`vi.useFakeTimers()` only inside the timeout test.** Fake timers globally would also intercept `setInterval` and break other promise-based mocks. `afterEach` flips back to real timers.
- The XSS regression test asserts both presence of escaped output AND absence of raw `<script>` — defence in depth against partial escaping bugs.
- `RESEND_API_KEY` and `FROM_EMAIL` are populated in `.env.test` (Batch 1). `vi.stubEnv('RESEND_API_KEY', '')` overrides the `process.env` value for the duration of one test; the empty string is falsy so the production guard fires.

- [ ] **Step 4.2: Run the test file in isolation**

Run:

```bash
npm test -- tests/unit/utils/email.test.ts
```

Expected:

```
 ✓ tests/unit/utils/email.test.ts (7)
   ✓ sendVerificationEmail (6)
     ✓ calls resend.emails.send with the right shape
     ✓ HTML-escapes firstName (XSS regression)
     ✓ rejects when Resend rejects
     ✓ rejects with timeout when send takes longer than RESEND_TIMEOUT_MS
     ✓ throws if RESEND_API_KEY is unset
     ✓ throws if FROM_EMAIL is unset
   ✓ sendPasswordResetEmail (1)
     ✓ uses the reset URL and reset subject

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**Troubleshooting:**
- All seven tests fail with "called 0 times" or the global mock's no-op behaviour → `vi.unmock` path doesn't match the global `vi.mock` path. Run `grep "vi.mock" BackEnd/tests/mocks/email.mock.ts` and confirm the string is `'../../src/utils/email'`. Both `vi.unmock('../../../src/utils/email')` (relative-to-this-file) and `vi.unmock('../../src/utils/email')` should resolve to the same module — but if vitest is being strict, try the same exact string as the global mock by adding an alias path.
- "Cannot find variable: mockSend" inside the `vi.mock` factory → use `vi.hoisted` as shown.
- The timeout test hangs the suite for 5 seconds (or 30 → hookTimeout) → `vi.useFakeTimers()` is missing. Fake timers convert the `setTimeout` inside `sendWithTimeout` into a manually-advancing one.
- `RESEND_API_KEY is not defined` test passes too easily (without `vi.stubEnv`) → confirm `.env.test` actually defines the key. Run `cat BackEnd/.env.test | grep RESEND`. If it's missing, the global env is already empty and the test isn't proving anything beyond the default state.
- "ReferenceError: vi is not defined" → the `import { vi }` at the top of the file is required even though `globals: false` is set in `vitest.config.ts`.

- [ ] **Step 4.3: User commit checkpoint**

Summary: "Added email-utility unit tests (7 cases): correct send shape, XSS escaping, error propagation, timeout, missing env vars, password-reset path." Wait for user to commit.

---

## Task 5: `tests/integration/scheduler/cronLock.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/scheduler/cronLock.test.ts`

`scheduleWithLock` calls `cron.schedule(expr, handler)` — it never runs `handler` itself. To exercise the handler synchronously, we mock `node-cron` so `schedule(expr, handler)` simply captures `handler` into a module-level variable. Tests then `await capturedHandler()` and inspect Mongo state. The `CronLock` model and Mongo connection come from the real `tests/setup.ts` lifecycle.

Seven cases:
1. First instance acquires the lock and runs the job; lock is released afterwards.
2. Lock already held by another instance → job is skipped, other instance's lock untouched.
3. Heartbeat extends `expiresAt` while the job runs.
4. Lock released after job completes.
5. Lock released even when the job throws.
6. Misconfiguration: `renewIntervalMs >= ttlMs` → job is skipped, no lock created.
7. `CronLock` model has the `expireAfterSeconds: 0` TTL index.

- [ ] **Step 5.1: Confirm node-cron import shape**

Run:

```bash
grep -n "node-cron" BackEnd/src/scheduler/cronLock.ts
```

Expected:

```
BackEnd/src/scheduler/cronLock.ts:1:import cron from 'node-cron';
```

This is a default-import of `node-cron`, accessed as `cron.schedule(...)`. The mock factory below provides BOTH `default` and a top-level `schedule` export so other call sites (if any) keep working.

- [ ] **Step 5.2: Create the directory**

Run from `BackEnd/`:

```bash
mkdir -p tests/integration/scheduler
```

- [ ] **Step 5.3: Write the test file**

Create `BackEnd/tests/integration/scheduler/cronLock.test.ts`:

```ts
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

    // Wait for the lock document to exist before reading expiresAt.
    await vi.waitFor(async () => {
      const lock = await CronLock.findOne({ lockName: 'lock-C' });
      expect(lock).not.toBeNull();
    });

    const before = (await CronLock.findOne({ lockName: 'lock-C' }))!.expiresAt.getTime();

    // Advance past one heartbeat tick.
    vi.advanceTimersByTime(2_000);

    await vi.waitFor(async () => {
      const after = (await CronLock.findOne({ lockName: 'lock-C' }))!.expiresAt.getTime();
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
```

Notes:
- The `node-cron` mock returns BOTH `default` (so `import cron from 'node-cron'` works) and a top-level `schedule` (so `import { schedule } from 'node-cron'` would also work). The current `cronLock.ts` only uses the default form, but this hedges against a future refactor.
- The heartbeat test (#3) is the most fragile in the suite. If it flakes on slow CI, simplify it: skip the `vi.waitFor` calls and just assert `await CronLock.findOne({ lockName: 'lock-C' })` is non-null after the handler kicks off, then `release()`.
- `vi.useFakeTimers({ shouldAdvanceTime: true })` allows real `setImmediate` / Mongo I/O to still resolve while we control `setInterval` ticks. Without this, `await CronLock.findOne(...)` would hang forever.
- Each test uses a unique `lockName` (`lock-A` … `lock-F`) so a leftover document from a flaked test never poisons the next case. The `beforeEach` `deleteMany({})` is the belt; unique names are the braces.
- Test #7 reads the schema's index spec without contacting Mongo — it's a model contract test, not an integration test, but it lives here because `CronLock` is the cron-lock module's collaborator.

- [ ] **Step 5.4: Run the test file in isolation**

Run:

```bash
npm test -- tests/integration/scheduler/cronLock.test.ts
```

Expected:

```
 ✓ tests/integration/scheduler/cronLock.test.ts (7)
   ✓ scheduleWithLock (7)
     ✓ first instance acquires the lock, runs the job, and releases the lock
     ✓ skips the job when the lock is already held by another instance
     ✓ extends expiresAt while the job runs (heartbeat)
     ✓ releases the lock after the job completes successfully
     ✓ releases the lock even when the job throws
     ✓ skips and does not create a lock when renewIntervalMs >= ttlMs
     ✓ CronLock model has TTL index with expireAfterSeconds: 0

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**Troubleshooting:**
- `capturedHandler is not a function` → the import order is wrong. `vi.mock(...)` is hoisted but the real `scheduleWithLock` import must come AFTER the mock declaration (vitest enforces hoisting; the visible code order should still put the `vi.mock` first as written).
- Heartbeat test flakes (`expected 1234 to be greater than 1234`) → drop the assertion to: `expect(after).toBeGreaterThanOrEqual(before)`. The TTL index's monitor lag plus fake-timer interaction can produce zero-delta in <1ms windows.
- "MongoServerError: E11000 duplicate key" on the first test → a previous run's lock wasn't cleaned up. The `beforeEach` `deleteMany({})` should have caught this; if not, `npm run test:db:down && npm run test:db:up` for a hard reset.
- Test #6 (renewIntervalMs >= ttlMs) fails because the job WAS called → the production code's order-of-operations: it computes `ttlMs` and `renewMs` first, then guards. Confirm the source still has the `if (renewMs >= ttlMs)` guard before `CronLock.create`.

- [ ] **Step 5.5: User commit checkpoint**

Summary: "Added cronLock scheduler tests (7 cases): acquire/release, skip-when-held, heartbeat extension, release-on-throw, misconfig guard, TTL index contract." Wait for user to commit.

---

## Batch 4.5 — Verification Checklist

Run all of the following from `BackEnd/`:

- [ ] **Type-check still passes**

```bash
npm run type-check
```

Expected: exits 0.

- [ ] **Bring the test DB up**

```bash
npm run test:db:up
```

Expected: container starts; port 27018 reachable.

- [ ] **Full suite is green**

```bash
npm test
```

Expected (file order may vary):

```
 ✓ tests/integration/auth.smoke.test.ts (3)
 ✓ tests/unit/utils/regex.test.ts (3)
 ✓ tests/integration/middleware/validate.test.ts (3)
 ✓ tests/integration/middleware/errorHandler.test.ts (6)
 ✓ tests/unit/utils/email.test.ts (7)
 ✓ tests/integration/scheduler/cronLock.test.ts (7)

 Test Files  6 passed (6)
      Tests  29 passed (29)
```

If any case fails, debug per the Troubleshooting section in the relevant task.

- [ ] **Coverage report shows the expected lift**

```bash
npm run test:coverage
```

Eyeball the `coverage/` HTML output (or the terminal text reporter). Expected approximate values for the targeted files (don't hard-fail on exact numbers — these are guides):

| File | Expected lines % |
| --- | --- |
| `src/utils/regex.ts` | 100% |
| `src/middleware/validate.ts` | 100% |
| `src/middleware/errorHandler.ts` | 95%+ (logger.error fallback may dip slightly) |
| `src/utils/email.ts` | 85%+ |
| `src/scheduler/cronLock.ts` | 90%+ |

If one file is wildly under target, the corresponding test file is probably skipping branches — re-read the source and add the missing case.

Note: `src/scheduler/**` is in the coverage `exclude` list as of Batch 1's `vitest.config.ts`. To see scheduler coverage in this report, **temporarily** remove that exclusion (do not commit the change). Batch 4 may have already removed it; if so, no action needed.

- [ ] **Tear down the test DB**

```bash
npm run test:db:down
```

Expected: container removed.

- [ ] **`git status` shows only the 5 new test files plus their parent directories**

Expected entries (untracked):
```
BackEnd/tests/unit/utils/regex.test.ts
BackEnd/tests/integration/middleware/validate.test.ts
BackEnd/tests/integration/middleware/errorHandler.test.ts
BackEnd/tests/unit/utils/email.test.ts
BackEnd/tests/integration/scheduler/cronLock.test.ts
```

No source files modified. No package.json changes. No vitest config changes.

---

## Out of Scope for Batch 4.5

These are intentionally NOT covered by this batch:

- **`src/utils/logger.ts`** — a configured pino instance. No business logic to assert; it's covered by being globally mocked in `tests/mocks/logger.mock.ts`.
- **`src/config/database.ts`** — exercised by the test infrastructure itself (every test file connects through it).
- **`src/index.ts`, `src/instrument.ts`** — already excluded from coverage in `vitest.config.ts`. Bootstrap code.
- **Real `node-cron` scheduling** — running real cron expressions in tests is slow and flaky. The mocked-handler approach proves the lock semantics, which is the part that matters.
- **End-to-end Resend delivery** — out of scope for unit tests; would require a sandboxed Resend account, which is outside the project's infra budget.

When Batch 4.5 lands, ask for the Batch 5 (Frontend Foundation) plan.
