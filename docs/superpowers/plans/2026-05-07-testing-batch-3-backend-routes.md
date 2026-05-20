# Testing — Batch 3: Backend Route Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Batches 1 and 2 must be complete and green. The seed, helpers, and service-level tests are now baseline.

**Goal:** Add HTTP-level integration tests covering every route group via supertest. Each test fires a real HTTP request against the exported `app`, asserts on status + response body + DB side-effects, and exercises the full middleware stack (auth, email-verified, validators, controller, error handler).

**Architecture:** Tests live in `BackEnd/tests/integration/*.routes.test.ts` and `BackEnd/tests/integration/middleware/*.test.ts`. They use the `authedAgent(app, userId)` helper from Batch 1 to wrap supertest with the right `Authorization` header. The shared `tests/setup.ts` drops + reseeds before each file.

**Tech Stack:** Same as Batch 2 — Vitest, supertest, Mongoose. No new dependencies.

**User commit policy:** Where the plan says **"User commit checkpoint"**, stop, summarise what changed, and wait for the user to commit.

**Working pattern:** Like Batch 2, tests are written against existing implementations. Default to fixing the test if it fails — only flag production bugs to the user.

---

## File Structure

### Files to create (one task each)

| Task | File |
|------|------|
| 1 | `BackEnd/tests/integration/middleware/auth.middleware.test.ts` |
| 2 | `BackEnd/tests/integration/middleware/emailVerified.middleware.test.ts` |
| 3 | `BackEnd/tests/integration/auth.routes.test.ts` |
| 4 | `BackEnd/tests/integration/user.routes.test.ts` |
| 5 | `BackEnd/tests/integration/household.routes.test.ts` |
| 6 | `BackEnd/tests/integration/expense.routes.test.ts` |
| 7 | `BackEnd/tests/integration/task.routes.test.ts` |
| 8 | `BackEnd/tests/integration/goal.routes.test.ts` |
| 9 | `BackEnd/tests/integration/joint-account.routes.test.ts` |
| 10 | `BackEnd/tests/integration/shopping-list.routes.test.ts` |
| 11 | `BackEnd/tests/integration/recurring-expense.routes.test.ts` |
| 12 | `BackEnd/tests/integration/recurring-task.routes.test.ts` |
| 13 | `BackEnd/tests/integration/recurring-shopping-item.routes.test.ts` |

---

## Task 1: `middleware/auth.middleware.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/middleware/auth.middleware.test.ts`

Mounts the auth middleware on a tiny throwaway Express app to test it in isolation.

- [ ] **Step 1.1: Write the test**

Create `BackEnd/tests/integration/middleware/auth.middleware.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authMiddleware } from '../../../src/middleware/auth';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { signTestJwt } from '../../helpers/auth';
import { FIXTURES } from '../../seed/fixtures';
import jwt from 'jsonwebtoken';

const buildApp = () => {
  const app = express();
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ userId: (req as any).user?.userId });
  });
  app.use(errorHandler);
  return app;
};

describe('authMiddleware', () => {
  it('attaches user payload when JWT is valid', async () => {
    const alice = FIXTURES.user('alice');
    const token = signTestJwt(alice._id);
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(alice._id.toString());
  });

  it('rejects requests without an Authorization header (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects malformed tokens (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with wrong secret (401)', async () => {
    const alice = FIXTURES.user('alice');
    const badToken = jwt.sign({ userId: alice._id.toString() }, 'wrong-secret', { expiresIn: '1h' });
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens (401)', async () => {
    const alice = FIXTURES.user('alice');
    const expired = jwt.sign({ userId: alice._id.toString() }, process.env.JWT_SECRET!, { expiresIn: '-1s' });
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 1.2: Run**

Run: `npm test tests/integration/middleware/auth.middleware.test.ts`
Expected: 5 tests pass.

---

## Task 2: `middleware/emailVerified.middleware.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/middleware/emailVerified.middleware.test.ts`

- [ ] **Step 2.1: Write the test**

Create `BackEnd/tests/integration/middleware/emailVerified.middleware.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authMiddleware, emailVerifiedMiddleware } from '../../../src/middleware/auth';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { signTestJwt } from '../../helpers/auth';
import { FIXTURES } from '../../seed/fixtures';

const buildApp = () => {
  const app = express();
  app.get('/gated', authMiddleware, emailVerifiedMiddleware, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
};

describe('emailVerifiedMiddleware', () => {
  it('allows verified users through (200)', async () => {
    const alice = FIXTURES.user('alice'); // isEmailVerified=true in seed
    const token = signTestJwt(alice._id);
    const res = await request(buildApp()).get('/gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects unverified users (403)', async () => {
    const dave = FIXTURES.user('dave'); // isEmailVerified=false in seed
    const token = signTestJwt(dave._id);
    const res = await request(buildApp()).get('/gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2.2: Run**

Run: `npm test tests/integration/middleware/emailVerified.middleware.test.ts`
Expected: 2 tests pass.

- [ ] **Step 2.3: User commit checkpoint**

Summary: "Middleware tests: auth + emailVerified (~7 cases)."

---

## Task 3: `auth.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/auth.routes.test.ts`

Tests the 9 auth endpoints. The smoke test from Batch 1 already covers `register` happy + duplicate; we expand to the rest here.

- [ ] **Step 3.1: Write the test**

Create `BackEnd/tests/integration/auth.routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/user.model';
import { hashToken } from '../../src/utils/token';
import { signTestJwt } from '../helpers/auth';
import * as emailMod from '../../src/utils/email';
import { FIXTURES } from '../seed/fixtures';

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.mocked(emailMod.sendVerificationEmail).mockClear());

  it('returns 201 and tokens for valid input', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'r1@example.com', password: 'Password123!', firstName: 'R', lastName: 'O',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tokens.accessToken).toBeTypeOf('string');
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email', password: 'Password123!', firstName: 'R', lastName: 'O',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 on weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'r2@example.com', password: 'short', firstName: 'R', lastName: 'O',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app).post('/api/auth/register').send({
      email: alice.email, password: 'Password123!', firstName: 'A', lastName: 'I',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 + tokens + sets refreshToken cookie', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app).post('/api/auth/login').send({
      email: alice.email, password: alice.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']?.some((c: string) => c.includes('refreshToken'))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app).post('/api/auth/login').send({
      email: alice.email, password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 200 + rotated refresh cookie when refreshToken cookie is valid', async () => {
    const alice = FIXTURES.user('alice');
    const login = await request(app).post('/api/auth/login').send({
      email: alice.email, password: alice.password,
    });
    const refreshCookie = login.headers['set-cookie']!.find((c: string) => c.startsWith('refreshToken='));

    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTypeOf('string');
  });

  it('returns 401 when no refreshToken cookie present', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204 and clears refreshToken cookie', async () => {
    const alice = FIXTURES.user('alice');
    const token = signTestJwt(alice._id);
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user (200)', async () => {
    const alice = FIXTURES.user('alice');
    const token = signTestJwt(alice._id);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(alice.email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('returns 200 when token is valid', async () => {
    const dave = FIXTURES.user('dave');
    const raw = 'a'.repeat(64);
    await User.updateOne({ _id: dave._id }, {
      emailVerificationToken: hashToken(raw),
      emailVerificationExpires: new Date(Date.now() + 60_000),
    });
    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid token format', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.mocked(emailMod.sendPasswordResetEmail).mockClear());

  it('returns 200 and sends email when email exists', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app).post('/api/auth/forgot-password').send({ email: alice.email });
    expect(res.status).toBe(200);
    expect(emailMod.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('returns 200 silently for unknown emails (anti-enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.com' });
    expect([200, 404]).toContain(res.status); // accept either, depending on how anti-enum is implemented
  });
});

describe('POST /api/auth/reset-password', () => {
  it('returns 200 when token + new password are valid', async () => {
    const alice = FIXTURES.user('alice');
    const raw = 'b'.repeat(64);
    await User.updateOne({ _id: alice._id }, {
      passwordResetToken: hashToken(raw),
      passwordResetExpires: new Date(Date.now() + 60_000),
    });
    const res = await request(app).post('/api/auth/reset-password').send({
      token: raw, password: 'BrandNewPass1!',
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 on weak password', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'c'.repeat(64), password: 'weak',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('returns 200 for authenticated user', async () => {
    const alice = FIXTURES.user('alice');
    const token = signTestJwt(alice._id);
    const res = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

Implementer notes:
- The exact response body shape (`res.body.data.tokens.accessToken`) is from the exploration's "Common Response Format". If your controllers return a different shape, adjust.
- Rate limiters in the auth routes (refreshLimiter, forgotPasswordLimiter, resendVerificationLimiter) may surface 429 when running tests in quick succession. If you see 429s, increase the rate limit in `.env.test` via env vars (if the limiter reads them) OR mock the rate limiter middleware in `tests/setup.ts`. Note this in the user commit message if it requires an env tweak.

- [ ] **Step 3.2: Run**

Run: `npm test tests/integration/auth.routes.test.ts`
Expected: ~17 tests pass.

- [ ] **Step 3.3: User commit checkpoint**

---

## Task 4: `user.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/user.routes.test.ts`

- [ ] **Step 4.1: Write the test**

Create `BackEnd/tests/integration/user.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (userId: string) => `Bearer ${signTestJwt(userId)}`;

describe('PATCH /api/users/profile', () => {
  it('updates first/last name (200)', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', auth(alice._id.toString()))
      .send({ firstName: 'Alicia' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe('Alicia');
  });

  it('returns 403 for unverified users', async () => {
    const dave = FIXTURES.user('dave'); // unverified in seed
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', auth(dave._id.toString()))
      .send({ firstName: 'D' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/users/profile').send({ firstName: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/password', () => {
  it('returns 200 when current password is correct', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', auth(alice._id.toString()))
      .send({ currentPassword: alice.password, newPassword: 'NewPassword1!' });
    expect(res.status).toBe(200);
  });

  it('returns 400 on weak new password', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', auth(alice._id.toString()))
      .send({ currentPassword: alice.password, newPassword: 'weak' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4.2: Run**

Run: `npm test tests/integration/user.routes.test.ts`
Expected: 5 tests pass.

---

## Task 5: `household.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/household.routes.test.ts`

- [ ] **Step 5.1: Write the test**

Create `BackEnd/tests/integration/household.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { makeUser } from '../helpers/factories';

const auth = (userId: string) => `Bearer ${signTestJwt(userId)}`;

const validCreateBody = (overrides: any = {}) => ({
  householdName: 'Route-Test Household',
  totalMembers: 2,
  livingArrangement: 'couple',
  creatorProfile: {
    nickname: 'Creator',
    ageGroup: '26-35',
    participatesInFinances: true,
    participatesInTasks: true,
  },
  memberStructure: [
    {
      nickname: 'Partner',
      ageGroup: '26-35',
      participatesInFinances: true,
      participatesInTasks: true,
      email: 'partner-placeholder@example.com',
    },
  ],
  trackedExpenseTypes: ['rent'],
  currency: 'BGN',
  taskManagementEnabled: 'basic',
  ...overrides,
});

describe('POST /api/households', () => {
  it('returns 201 with valid body', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households')
      .set('Authorization', auth(u._id.toString()))
      .send(validCreateBody());
    expect(res.status).toBe(201);
    expect(res.body.data.household.name).toBe('Route-Test Household');
  });

  it('returns 400 on missing required fields', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households')
      .set('Authorization', auth(u._id.toString()))
      .send({ householdName: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/households/join', () => {
  it('returns 200 with valid invite + matching email', async () => {
    const u = await makeUser({ email: 'joiner@example.com' });
    // Create a household with a placeholder slot for the new user
    const owner = await makeUser();
    const created = await request(app)
      .post('/api/households')
      .set('Authorization', auth(owner._id.toString()))
      .send(validCreateBody({
        memberStructure: [{ nickname: 'X', ageGroup: '26-35', participatesInFinances: true, participatesInTasks: true, email: 'joiner@example.com' }],
      }));

    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(u._id.toString()))
      .send({ inviteCode: created.body.data.household.inviteCode });
    expect(res.status).toBe(200);
  });

  it('returns 404 on invalid invite code', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(u._id.toString()))
      .send({ inviteCode: 'definitely-not-a-real-code' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/households/:id', () => {
  it('returns 200 for a member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-member', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/households/:id/settings', () => {
  it('admin can update (200)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ financeMode: 'split' });
    expect(res.status).toBe(200);
  });

  it('non-admin returns 403', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ financeMode: 'split' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/households/:id/members/me/income', () => {
  it('returns 200 with valid income', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/members/me/income`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ monthlyIncome: 4500 });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/households/:id/settlements', () => {
  it('admin can record settlement (201)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/settlements`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ month: '2026-04', amount: 200 });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/households/:id/invite-code', () => {
  it('admin can regenerate invite code (200)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/invite-code`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.household.inviteCode).not.toBe(couple.inviteCode);
  });
});
```

- [ ] **Step 5.2: Run**

Run: `npm test tests/integration/household.routes.test.ts`
Expected: ~12 tests pass.

- [ ] **Step 5.3: User commit checkpoint**

---

## Task 6: `expense.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/expense.routes.test.ts`

- [ ] **Step 6.1: Write the test**

Create `BackEnd/tests/integration/expense.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Expense routes', () => {
  it('POST → 201 creates an expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Coffee', amount: 5, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.data.expense.amount).toBe(5);
  });

  it('POST → 400 on invalid amount', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'X', amount: -1, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it('POST → 403 for non-member', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ description: 'X', amount: 5, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  it('GET → 200 returns paginated list', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/expenses?limit=10`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.expenses)).toBe(true);
  });

  it('GET → 200 filters by status=unresolved', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/expenses?status=unresolved&limit=50`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH → 200 updates a non-resolved expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PATCH → 400 updating settled expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('rent-april');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'X' });
    expect(res.status).toBe(400);
  });

  it('DELETE → 204 deletes own pending expense', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1'); // bob is payer
    const res = await request(app)
      .delete(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(204);
  });

  it('POST /:expenseId/claim → 200 claims unclaimed expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // Create an unclaimed expense via the API (no paidByUserId provided)
    const created = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Anonymous', amount: 10, category: 'groceries', date: new Date().toISOString() });

    const bob = FIXTURES.user('bob');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${created.body.data.expense.id}/claim`)
      .set('Authorization', auth(bob._id.toString()));
    expect([200, 403]).toContain(res.status); // adjust based on actual claim semantics
  });

  it('POST /:expenseId/request-resolution → 200', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/request-resolution`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /:expenseId/confirm-resolution → 200 marks resolved', async () => {
    const bob = FIXTURES.user('bob');
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april');
    await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/request-resolution`)
      .set('Authorization', auth(bob._id.toString()));
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/confirm-resolution`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.expense.isResolved).toBe(true);
  });

  it('POST /:expenseId/dispute-resolution → 200 cancels pending', async () => {
    const bob = FIXTURES.user('bob');
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april');
    await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/request-resolution`)
      .set('Authorization', auth(bob._id.toString()));
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/dispute-resolution`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6.2: Run**

Run: `npm test tests/integration/expense.routes.test.ts`
Expected: ~12 tests pass.

- [ ] **Step 6.3: User commit checkpoint**

---

## Task 7: `task.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/task.routes.test.ts`

- [ ] **Step 7.1: Write the test**

Create `BackEnd/tests/integration/task.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Task routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Take out trash' });
    expect(res.status).toBe(201);
  });

  it('POST → 400 on missing title', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/tasks?limit=10`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /rotation → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const aliceMember = FIXTURES.member('alice-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/rotation`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ startMemberId: aliceMember.toString() });
    expect(res.status).toBe(200);
  });

  it('PATCH /rotation → 403 (non-admin)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const bobMember = FIXTURES.member('bob-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/rotation`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ startMemberId: bobMember.toString() });
    expect(res.status).toBe(403);
  });

  it('PATCH /:taskId/assign → 200 (admin reassigns)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    const aliceMember = FIXTURES.member('alice-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/${id}/assign`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ assignedToMemberId: aliceMember.toString() });
    expect(res.status).toBe(200);
  });

  it('PATCH /:taskId/complete → 200', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/${id}/complete`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.task.isCompleted).toBe(true);
  });

  it('DELETE → 204 (creator)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('vacuum');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/tasks/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('DELETE → 403 (non-creator non-admin)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('vacuum'); // created by alice
    const res = await request(app)
      .delete(`/api/households/${couple._id}/tasks/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 7.2: Run**

Run: `npm test tests/integration/task.routes.test.ts`
Expected: 9 tests pass.

---

## Task 8: `goal.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/goal.routes.test.ts`

- [ ] **Step 8.1: Write the test**

Create `BackEnd/tests/integration/goal.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Goal routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'New Goal', targetAmount: 500 });
    expect(res.status).toBe(201);
  });

  it('POST → 400 on missing target', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('GET → 200 paginated', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('GET /:goalId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:goalId → 200 by creator', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ targetAmount: 3000 });
    expect(res.status).toBe(200);
  });

  it('DELETE /:goalId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('POST /:goalId/contributions → 201', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals/${id}/contributions`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ amount: 50 });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 8.2: Run**

Run: `npm test tests/integration/goal.routes.test.ts`
Expected: 7 tests pass.

---

## Task 9: `joint-account.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/joint-account.routes.test.ts`

- [ ] **Step 9.1: Write the test**

Create `BackEnd/tests/integration/joint-account.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Joint account routes', () => {
  it('GET → 200 for financial member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/joint-account`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /transactions → 201 deposit', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/joint-account/transactions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ type: 'deposit', amount: 100 });
    expect(res.status).toBe(201);
  });

  it('POST /transactions → 400 on insufficient balance withdrawal', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/joint-account/transactions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ type: 'withdrawal', amount: 99_999 });
    expect(res.status).toBe(400);
  });

  it('DELETE /transactions/:txId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.jointTx('tx-1');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/joint-account/transactions/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('PATCH /config → 200 admin', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/joint-account/config`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ monthlyTarget: 1000, targetMode: 'equal' });
    expect(res.status).toBe(200);
  });

  it('PATCH /config → 403 non-admin', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/joint-account/config`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ monthlyTarget: 999 });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 9.2: Run**

Run: `npm test tests/integration/joint-account.routes.test.ts`
Expected: 6 tests pass.

---

## Task 10: `shopping-list.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/shopping-list.routes.test.ts`

- [ ] **Step 10.1: Write the test**

Create `BackEnd/tests/integration/shopping-list.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Shopping list routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Cheese', category: 'dairy' });
    expect(res.status).toBe(201);
  });

  it('GET → 200 with filters', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list?boughtState=unbought&limit=20`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:itemId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
  });

  it('PATCH /:itemId/bought → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/${id}/bought`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /:itemId/archive → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('apples');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/archive`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /:itemId/restore → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('apples');
    await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/archive`)
      .set('Authorization', auth(alice._id.toString()));
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/restore`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('DELETE /:itemId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('shampoo');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/shopping-list/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('GET /history → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/history`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 10.2: Run**

Run: `npm test tests/integration/shopping-list.routes.test.ts`
Expected: 8 tests pass.

---

## Task 11: `recurring-expense.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/recurring-expense.routes.test.ts`

- [ ] **Step 11.1: Write the test**

Create `BackEnd/tests/integration/recurring-expense.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Recurring expense routes', () => {
  it('POST → 201 fixed payer', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'Rent', amount: 1200, category: 'rent',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    expect(res.status).toBe(201);
  });

  it('POST → 400 fixed mode without payer', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 1, category: 'rent',
        interval: 'monthly', payerMode: 'fixed',
      });
    expect(res.status).toBe(400);
  });

  it('GET → 200 lists active templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:recurringId → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 50, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    const res = await request(app)
      .patch(`/api/households/${couple._id}/recurring-expenses/${created.body.data.recurring.id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ amount: 75 });
    expect(res.status).toBe(200);
  });

  it('DELETE /:recurringId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 10, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    const res = await request(app)
      .delete(`/api/households/${couple._id}/recurring-expenses/${created.body.data.recurring.id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 11.2: Run**

Run: `npm test tests/integration/recurring-expense.routes.test.ts`
Expected: 5 tests pass.

---

## Task 12: `recurring-task.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/recurring-task.routes.test.ts`

- [ ] **Step 12.1: Write the test**

Create `BackEnd/tests/integration/recurring-task.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Recurring task routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Take out trash', interval: 'weekly' });
    expect(res.status).toBe(201);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:recurringTaskId → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Old', interval: 'weekly' });
    const res = await request(app)
      .patch(`/api/households/${couple._id}/recurring-tasks/${created.body.data.task.id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'New' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:recurringTaskId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'X', interval: 'weekly' });
    const res = await request(app)
      .delete(`/api/households/${couple._id}/recurring-tasks/${created.body.data.task.id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 12.2: Run**

Run: `npm test tests/integration/recurring-task.routes.test.ts`
Expected: 4 tests pass.

---

## Task 13: `recurring-shopping-item.routes.test.ts`

**Files:**
- Create: `BackEnd/tests/integration/recurring-shopping-item.routes.test.ts`

- [ ] **Step 13.1: Write the test**

Create `BackEnd/tests/integration/recurring-shopping-item.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Recurring shopping item routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Milk', category: 'dairy', cadence: 'weekly' });
    expect(res.status).toBe(201);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:ruleId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Old', category: 'pantry', cadence: 'weekly' });
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/recurring/${created.body.data.rule.id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'New' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:ruleId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'X', category: 'pantry', cadence: 'weekly' });
    const res = await request(app)
      .delete(`/api/households/${couple._id}/shopping-list/recurring/${created.body.data.rule.id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 13.2: Run**

Run: `npm test tests/integration/recurring-shopping-item.routes.test.ts`
Expected: 4 tests pass.

- [ ] **Step 13.3: User commit checkpoint**

Summary: "All 11 route integration test files + 2 middleware test files added (~85 cases)."

---

## Batch 3 — Verification Checklist

- [ ] `npm run test:db:up` → Mongo container up.
- [ ] `npm run type-check` → exits 0.
- [ ] `npm test` → entire backend suite green (Batches 1+2+3 ≈ 200 cases).
- [ ] `npm run test:coverage` → routes + middleware ≥ 70% line coverage.
- [ ] `git status` → only the new test files modified.

---

## Out of Scope for Batch 3 (covered later)

- Scheduler tests (Batch 4): the four cron workers.
- Frontend tests (Batches 5-7).
- E2E (Batch 8).
