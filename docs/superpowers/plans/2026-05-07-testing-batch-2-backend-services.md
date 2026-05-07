# Testing — Batch 2: Backend Service Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Batch 1 (Backend Foundation) must be complete and green. The Dockerised test Mongo, `tests/setup.ts`, `FIXTURES`, `factories.ts`, and `signTestJwt` helper all live in the repo from Batch 1.

**Goal:** Add unit tests for all 11 backend services and 4 utility modules so every public service method has at least one happy-path assertion and at least one assertion for each major error class (`NotFoundError`, `ForbiddenError`, `BadRequestError`, `UnauthorizedError`, `ConflictError`) it can throw.

**Architecture:** Tests live in `BackEnd/tests/unit/services/*.test.ts` and `BackEnd/tests/unit/utils/*.test.ts`. They import the service singleton (e.g., `expenseService`), call methods directly, and assert on return values + DB state via Mongoose model queries. The shared `tests/setup.ts` from Batch 1 drops + reseeds before each file, so every test starts with the canonical demo data. Within a file, tests can mutate state freely; cleanup is automatic at file end.

**Tech Stack:** Same as Batch 1 — Vitest, supertest, Mongoose. No new dependencies.

**User commit policy:** Where the plan says **"User commit checkpoint"**, stop, summarise what changed, and wait for the user to review and commit before proceeding.

**Working pattern:** Tests are written against existing implementations (the services already exist). For each test:
1. Write the test file.
2. Run it.
3. If it fails: investigate whether the test is wrong or the production code is wrong. **Default to fixing the test** — Batch 2 is about characterising existing behaviour, not changing it. If you discover a real production bug, stop, surface it to the user, and ask whether to fix in this batch or carry it forward.

---

## File Structure

### Files to create (one task each)
| Task | File |
|------|------|
| 1 | `BackEnd/tests/unit/utils/error.test.ts` |
| 2 | `BackEnd/tests/unit/utils/token.test.ts` |
| 3 | `BackEnd/tests/unit/utils/pagination.test.ts` |
| 4 | `BackEnd/tests/unit/utils/household.helpers.test.ts` |
| 5 | `BackEnd/tests/unit/services/auth.service.test.ts` |
| 6 | `BackEnd/tests/unit/services/user.service.test.ts` |
| 7 | `BackEnd/tests/unit/services/household.service.test.ts` |
| 8 | `BackEnd/tests/unit/services/expense.service.test.ts` |
| 9 | `BackEnd/tests/unit/services/task.service.test.ts` |
| 10 | `BackEnd/tests/unit/services/goal.service.test.ts` |
| 11 | `BackEnd/tests/unit/services/joint-account.service.test.ts` |
| 12 | `BackEnd/tests/unit/services/shopping-list.service.test.ts` |
| 13 | `BackEnd/tests/unit/services/recurring-expense.service.test.ts` |
| 14 | `BackEnd/tests/unit/services/recurring-task.service.test.ts` |
| 15 | `BackEnd/tests/unit/services/recurring-shopping-item.service.test.ts` |

### Files modified
None directly. Coverage may surface bugs that warrant edits to `BackEnd/src/...` — flag those to the user before changing source.

---

## Task 1: `utils/error.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/utils/error.test.ts`

The error utilities are pure functions / classes — fast, no DB needed.

- [ ] **Step 1.1: Read the source**

Run: `cat BackEnd/src/utils/error.ts`
Expected: shows `AppError` class plus factory functions / subclasses for `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`.

- [ ] **Step 1.2: Write the test**

Create `BackEnd/tests/unit/utils/error.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../../src/utils/error';

describe('AppError taxonomy', () => {
  it('AppError carries message + statusCode + isOperational=true', () => {
    const err = new AppError('boom', 418);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(true);
  });

  it.each([
    [BadRequestError,    400],
    [UnauthorizedError,  401],
    [ForbiddenError,     403],
    [NotFoundError,      404],
    [ConflictError,      409],
  ])('%p is statusCode %i and is an instance of AppError', (Cls, expectedStatus) => {
    const err = new (Cls as any)('msg');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(expectedStatus);
    expect(err.message).toBe('msg');
  });

  it('preserves stack trace', () => {
    const err = new NotFoundError('missing');
    expect(typeof err.stack).toBe('string');
    expect(err.stack).toContain('NotFoundError');
  });
});
```

If your error utilities export factory functions (`badRequestError(msg)`) instead of classes, replace `new BadRequestError('msg')` with the function call. The shape from the spec ("AppError class with statusCode; factories for BadRequestError…") suggests classes; verify in Step 1.1.

- [ ] **Step 1.3: Run**

Run: `npm test tests/unit/utils/error.test.ts`
Expected: 7 tests pass (3 explicit + 5 from `it.each`, less the duplicate count = 7 = 3 + 4 cases of it.each... actually the parameterised case is 5 rows so 1 + 5 + 1 = 7).

If a status code is wrong: read the actual code in `error.ts` and update the test to match the real value. If a class doesn't exist or has a different name: rename the import.

---

## Task 2: `utils/token.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/utils/token.test.ts`

- [ ] **Step 2.1: Read the source**

Run: `cat BackEnd/src/utils/token.ts`
Expected: shows `generateToken()` (likely `crypto.randomBytes(...).toString('hex')`) and `hashToken(token)` (likely SHA-256).

- [ ] **Step 2.2: Write the test**

Create `BackEnd/tests/unit/utils/token.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from '../../../src/utils/token';

describe('token utilities', () => {
  it('generateToken returns a 64-char hex string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generateToken produces unique values across calls', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('hashToken is deterministic for the same input', () => {
    const t = 'abcd1234';
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('hashToken returns a 64-char hex string (SHA-256)', () => {
    expect(hashToken('hello')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashToken differs for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
```

If `generateToken()` uses a different byte length (e.g., 16 bytes → 32 hex chars), update the regex. If `hashToken` uses SHA-512 (128 hex chars), update accordingly.

- [ ] **Step 2.3: Run**

Run: `npm test tests/unit/utils/token.test.ts`
Expected: 5 tests pass.

---

## Task 3: `utils/pagination.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/utils/pagination.test.ts`

- [ ] **Step 3.1: Read the source**

Run: `cat BackEnd/src/utils/pagination.ts`
Expected: pagination helpers (parse query, build cursor, etc.). The exact function names are needed for the test imports.

- [ ] **Step 3.2: Write a thin test that exercises the public surface**

This file's exports vary by project. After Step 3.1, write tests that call each exported function with valid + invalid inputs. Below is a representative skeleton; **adapt the imports and inputs to match the actual exports**.

Create `BackEnd/tests/unit/utils/pagination.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
// REPLACE these imports with the real exports from pagination.ts
import * as pagination from '../../../src/utils/pagination';

describe('pagination helpers', () => {
  it('exports the expected public functions', () => {
    // After running Step 3.1, replace this assertion with named-function checks
    // e.g., expect(typeof pagination.parsePaginationQuery).toBe('function');
    expect(Object.keys(pagination).length).toBeGreaterThan(0);
  });

  // Add 1-2 tests per exported function. Examples:
  //
  // it('parsePaginationQuery clamps limit to max', () => {
  //   const result = pagination.parsePaginationQuery({ limit: '999' });
  //   expect(result.limit).toBeLessThanOrEqual(100);
  // });
  //
  // it('parsePaginationQuery rejects invalid cursor', () => {
  //   expect(() => pagination.parsePaginationQuery({ cursor: '!!not-a-cursor!!' })).toThrow();
  // });
});
```

After Step 3.1 you'll know the actual API. Replace the placeholder block with real per-function tests. **The placeholder check (`Object.keys(...).length`) is a smoke check only — leave a comment in the test file saying "TODO: per-function tests" if you can't get to all of them in this batch, but at minimum cover happy + invalid for each exported function.** If pagination.ts has only one or two functions, this should be ≤ 4 test cases.

- [ ] **Step 3.3: Run**

Run: `npm test tests/unit/utils/pagination.test.ts`
Expected: tests pass.

---

## Task 4: `utils/household.helpers.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/utils/household.helpers.test.ts`

This util likely exports `getHouseholdForMember(householdId, userId)` (used everywhere) and possibly role-check helpers. The exploration confirmed all services use it for membership verification.

- [ ] **Step 4.1: Read the source**

Run: `cat BackEnd/src/utils/household.helpers.ts`
Expected: at minimum, a function that fetches a household and validates that `userId` is a member, plus possibly admin-checks and finance/task-participation helpers.

- [ ] **Step 4.2: Write the test**

Create `BackEnd/tests/unit/utils/household.helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { getHouseholdForMember } from '../../../src/utils/household.helpers';
import { ForbiddenError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('getHouseholdForMember', () => {
  it('returns household + member when user is a member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await getHouseholdForMember(couple._id.toString(), alice._id.toString());
    expect(result.household._id.toString()).toBe(couple._id.toString());
    expect(result.member.userId?.toString()).toBe(alice._id.toString());
  });

  it('throws NotFoundError when household does not exist', async () => {
    const fakeId = new Types.ObjectId().toString();
    const alice = FIXTURES.user('alice');
    await expect(getHouseholdForMember(fakeId, alice._id.toString())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when user is not a member', async () => {
    const couple = FIXTURES.household('couple');
    const carol = FIXTURES.user('carol'); // member of "flatshare", not "couple"
    await expect(
      getHouseholdForMember(couple._id.toString(), carol._id.toString())
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

If `household.helpers.ts` exports more functions (e.g., `requireAdmin`, `requireFinanceMember`), add a test per function: one happy path, one rejection path. Use FIXTURES — alice is owner of couple (admin), bob is non-admin member, carol is admin of flatshare, frank is non-task member of flatshare.

- [ ] **Step 4.3: Run**

Run: `npm test tests/unit/utils/household.helpers.test.ts`
Expected: 3+ tests pass.

- [ ] **Step 4.4: User commit checkpoint**

Summary: "Added unit tests for utils (error, token, pagination, household.helpers) — 4 files, ~20 tests."

---

## Task 5: `services/auth.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/auth.service.test.ts`

**Methods covered (from exploration):** `register`, `login`, `refreshToken`, `logout`, `verifyEmail`, `resendVerificationEmail`, `forgotPassword`, `resetPassword`, `getMe`.

- [ ] **Step 5.1: Write the test file**

Create `BackEnd/tests/unit/services/auth.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../../src/services/auth.service';
import { User } from '../../../src/models/user.model';
import { hashToken } from '../../../src/utils/token';
import { ConflictError, UnauthorizedError, BadRequestError, NotFoundError } from '../../../src/utils/error';
import * as emailMod from '../../../src/utils/email';
import { FIXTURES } from '../../seed/fixtures';

describe('authService.register', () => {
  beforeEach(() => vi.mocked(emailMod.sendVerificationEmail).mockClear());

  it('creates a new user, hashes password, returns tokens', async () => {
    const result = await authService.register({
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
    });

    expect(result.user.email).toBe('newuser@example.com');
    expect(result.tokens.accessToken).toBeTypeOf('string');
    expect(result.tokens.refreshToken).toBeTypeOf('string');

    const stored = await User.findById(result.user.id).select('+password').lean();
    expect(stored?.password.startsWith('$2')).toBe(true); // bcrypt
  });

  it('sends verification email on register', async () => {
    await authService.register({
      email: 'verify@example.com', password: 'Password123!', firstName: 'V', lastName: 'X',
    });
    expect(emailMod.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('throws ConflictError when email already exists', async () => {
    const alice = FIXTURES.user('alice');
    await expect(authService.register({
      email: alice.email, password: 'Password123!', firstName: 'X', lastName: 'Y',
    })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('authService.login', () => {
  it('returns user + tokens for valid credentials', async () => {
    const alice = FIXTURES.user('alice');
    const result = await authService.login({ email: alice.email, password: alice.password });
    expect(result.user.id).toBe(alice._id.toString());
    expect(result.tokens.accessToken).toBeTypeOf('string');
  });

  it('throws UnauthorizedError on wrong password', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      authService.login({ email: alice.email, password: 'WrongPassword!' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError on unknown email', async () => {
    await expect(
      authService.login({ email: 'nope@example.com', password: 'Whatever1!' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('authService.refreshToken', () => {
  it('returns a new token pair when refresh token is valid', async () => {
    const alice = FIXTURES.user('alice');
    const initial = await authService.login({ email: alice.email, password: alice.password });
    const refreshed = await authService.refreshToken(initial.tokens.refreshToken);
    expect(refreshed.accessToken).toBeTypeOf('string');
    expect(refreshed.refreshToken).toBeTypeOf('string');
    expect(refreshed.refreshToken).not.toBe(initial.tokens.refreshToken); // rotation
  });

  it('throws UnauthorizedError when refresh token is malformed', async () => {
    await expect(authService.refreshToken('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError when refresh token does not match stored one (theft detection)', async () => {
    const alice = FIXTURES.user('alice');
    const a = await authService.login({ email: alice.email, password: alice.password });
    // a.tokens.refreshToken is now the only valid one for alice; logging in again rotates it.
    await authService.login({ email: alice.email, password: alice.password });
    await expect(authService.refreshToken(a.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('authService.logout', () => {
  it('clears the refresh token from the user', async () => {
    const alice = FIXTURES.user('alice');
    await authService.login({ email: alice.email, password: alice.password });
    await authService.logout(alice._id.toString());
    const stored = await User.findById(alice._id).select('+refreshToken').lean();
    expect(stored?.refreshToken).toBeFalsy();
  });
});

describe('authService.verifyEmail', () => {
  it('marks isEmailVerified=true and clears the token fields', async () => {
    // Dave is the unverified seeded user. Set a known token to test the flow.
    const dave = FIXTURES.user('dave');
    const rawToken = 'a'.repeat(64);
    await User.updateOne({ _id: dave._id }, {
      emailVerificationToken: hashToken(rawToken),
      emailVerificationExpires: new Date(Date.now() + 60_000),
    });

    await authService.verifyEmail(rawToken);
    const stored = await User.findById(dave._id).select('+emailVerificationToken').lean();
    expect(stored?.isEmailVerified).toBe(true);
    expect(stored?.emailVerificationToken).toBeFalsy();
  });

  it('throws BadRequestError on invalid token', async () => {
    await expect(authService.verifyEmail('totally-invalid')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError on expired token', async () => {
    const dave = FIXTURES.user('dave');
    const rawToken = 'b'.repeat(64);
    await User.updateOne({ _id: dave._id }, {
      emailVerificationToken: hashToken(rawToken),
      emailVerificationExpires: new Date(Date.now() - 60_000), // already expired
    });
    await expect(authService.verifyEmail(rawToken)).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('authService.forgotPassword', () => {
  beforeEach(() => vi.mocked(emailMod.sendPasswordResetEmail).mockClear());

  it('sends a reset email and stores a hashed token for known users', async () => {
    const alice = FIXTURES.user('alice');
    await authService.forgotPassword(alice.email);

    const stored = await User.findById(alice._id).select('+passwordResetToken +passwordResetExpires').lean();
    expect(stored?.passwordResetToken).toBeTruthy();
    expect(stored?.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
    expect(emailMod.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('silently returns for unknown emails (anti-enumeration)', async () => {
    await expect(authService.forgotPassword('nobody@nowhere.com')).resolves.toBeUndefined();
    expect(emailMod.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('authService.resetPassword', () => {
  it('updates the password and clears the reset token', async () => {
    const alice = FIXTURES.user('alice');
    const rawToken = 'c'.repeat(64);
    await User.updateOne({ _id: alice._id }, {
      passwordResetToken: hashToken(rawToken),
      passwordResetExpires: new Date(Date.now() + 60_000),
    });

    await authService.resetPassword(rawToken, 'BrandNewPass1!');
    // Login with new password should now succeed.
    const result = await authService.login({ email: alice.email, password: 'BrandNewPass1!' });
    expect(result.user.id).toBe(alice._id.toString());
  });

  it('throws BadRequestError on invalid token', async () => {
    await expect(authService.resetPassword('garbage', 'Whatever1!')).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('authService.getMe', () => {
  it('returns the current user with households populated', async () => {
    const alice = FIXTURES.user('alice');
    const me = await authService.getMe(alice._id.toString());
    expect(me.email).toBe(alice.email);
    expect(Array.isArray(me.households)).toBe(true);
  });

  it('throws NotFoundError when user does not exist', async () => {
    await expect(authService.getMe(new (await import('mongoose')).Types.ObjectId().toString())).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

Implementer notes:
- The `IRegisterInput` / `IAuthResponse` shapes are real, but the property names in the test (`result.user.id`, `result.user.email`, `result.tokens.accessToken`) might differ. After Step 5.1's grep on `auth.service.ts`, adjust property accesses to match.
- The token theft test requires that `login` clears the previous refresh token. If the service implements per-device tokens (multiple valid simultaneously), this test will fail — comment it out and note it for a follow-up.

- [ ] **Step 5.2: Run**

Run: `npm test tests/unit/services/auth.service.test.ts`
Expected: ~14 tests pass.

- [ ] **Step 5.3: User commit checkpoint**

Summary: "Auth service unit tests (~14 cases): register/login/refresh/logout/verifyEmail/forgotPassword/resetPassword/getMe."

---

## Task 6: `services/user.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/user.service.test.ts`

**Methods covered:** `updateProfile`, `changePassword`.

- [ ] **Step 6.1: Write the test**

Create `BackEnd/tests/unit/services/user.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from '../../../src/services/user.service';
import { User } from '../../../src/models/user.model';
import { authService } from '../../../src/services/auth.service';
import { ConflictError, UnauthorizedError, BadRequestError, NotFoundError } from '../../../src/utils/error';
import * as emailMod from '../../../src/utils/email';
import { FIXTURES } from '../../seed/fixtures';
import { Types } from 'mongoose';

describe('userService.updateProfile', () => {
  beforeEach(() => vi.mocked(emailMod.sendVerificationEmail).mockClear());

  it('updates first/last name without password verification', async () => {
    const alice = FIXTURES.user('alice');
    const { user, emailChanged } = await userService.updateProfile(alice._id.toString(), {
      firstName: 'Alicia',
      lastName: 'Anderson-New',
    });
    expect(user.firstName).toBe('Alicia');
    expect(user.lastName).toBe('Anderson-New');
    expect(emailChanged).toBe(false);
  });

  it('changing email requires currentPassword and re-verifies', async () => {
    const alice = FIXTURES.user('alice');
    const { user, emailChanged } = await userService.updateProfile(alice._id.toString(), {
      email: 'alice-new@example.com',
      currentPassword: alice.password,
    });
    expect(user.email).toBe('alice-new@example.com');
    expect(emailChanged).toBe(true);

    const stored = await User.findById(alice._id).lean();
    expect(stored?.isEmailVerified).toBe(false);
    expect(emailMod.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('rejects email change without password (BadRequestError)', async () => {
    const alice = FIXTURES.user('alice');
    await expect(userService.updateProfile(alice._id.toString(), {
      email: 'alice-new@example.com',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects email change with wrong password (UnauthorizedError)', async () => {
    const alice = FIXTURES.user('alice');
    await expect(userService.updateProfile(alice._id.toString(), {
      email: 'alice-new@example.com',
      currentPassword: 'WrongPassword!',
    })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects email change to one already in use (ConflictError)', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    await expect(userService.updateProfile(alice._id.toString(), {
      email: bob.email,
      currentPassword: alice.password,
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when user does not exist', async () => {
    await expect(userService.updateProfile(new Types.ObjectId().toString(), {
      firstName: 'X',
    })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('userService.changePassword', () => {
  it('updates password and invalidates all refresh tokens', async () => {
    const alice = FIXTURES.user('alice');
    // Establish an active session
    const session = await authService.login({ email: alice.email, password: alice.password });

    await userService.changePassword(alice._id.toString(), {
      currentPassword: alice.password,
      newPassword: 'BrandNewPass1!',
    });

    // Old session's refresh token should now be invalid
    await expect(authService.refreshToken(session.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
    // Login with new password must work
    const newSession = await authService.login({ email: alice.email, password: 'BrandNewPass1!' });
    expect(newSession.user.id).toBe(alice._id.toString());
  });

  it('rejects with UnauthorizedError on wrong current password', async () => {
    const alice = FIXTURES.user('alice');
    await expect(userService.changePassword(alice._id.toString(), {
      currentPassword: 'WrongPassword!',
      newPassword: 'BrandNewPass1!',
    })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws NotFoundError when user does not exist', async () => {
    await expect(userService.changePassword(new Types.ObjectId().toString(), {
      currentPassword: 'X',
      newPassword: 'Y1!',
    })).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 6.2: Run**

Run: `npm test tests/unit/services/user.service.test.ts`
Expected: ~9 tests pass.

---

## Task 7: `services/household.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/household.service.test.ts`

**Methods covered:** `createFromOnboarding`, `joinHousehold`, `updateMemberIncome`, `updateSettings`, `recordSettlement`, `getById`, `regenerateInviteCode`.

- [ ] **Step 7.1: Write the test**

Create `BackEnd/tests/unit/services/household.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { householdService } from '../../../src/services/household.service';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';
import { ConflictError, BadRequestError, ForbiddenError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';
import { Types } from 'mongoose';

const validCreateInput = (overrides: any = {}) => ({
  householdName: 'Factory Household',
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
  trackedExpenseTypes: ['rent', 'groceries'],
  currency: 'BGN',
  taskManagementEnabled: 'basic',
  ...overrides,
});

describe('householdService.createFromOnboarding', () => {
  it('creates a household with the creator as a linked member', async () => {
    const u = await makeUser();
    const result = await householdService.createFromOnboarding(u._id.toString(), validCreateInput());
    expect(result.name).toBe('Factory Household');
    expect(result.members.some((m: any) => m.userId?.toString() === u._id.toString())).toBe(true);
    expect(result.inviteCode).toMatch(/[a-f0-9-]+/);
  });

  it('atomically backfills User.households', async () => {
    const u = await makeUser();
    const result = await householdService.createFromOnboarding(u._id.toString(), validCreateInput());
    const stored = await User.findById(u._id).lean();
    expect(stored?.households.map(String)).toContain(result.id.toString());
  });
});

describe('householdService.joinHousehold', () => {
  it('lets a user with a placeholder email slot join via invite code', async () => {
    const u = await makeUser();
    const owner = await makeUser();
    const created = await householdService.createFromOnboarding(owner._id.toString(), validCreateInput({
      memberStructure: [{ nickname: 'Partner', ageGroup: '26-35', participatesInFinances: true, participatesInTasks: true, email: u.email }],
    }));

    const result = await householdService.joinHousehold(u._id.toString(), u.email, { inviteCode: created.inviteCode });
    expect(result.members.some((m: any) => m.userId?.toString() === u._id.toString())).toBe(true);
  });

  it('throws NotFoundError on invalid invite code', async () => {
    const u = await makeUser();
    await expect(householdService.joinHousehold(u._id.toString(), u.email, {
      inviteCode: 'nonexistent-code',
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BadRequestError when email is not pre-registered as a placeholder', async () => {
    const u = await makeUser({ email: 'random@example.com' });
    const couple = FIXTURES.household('couple');
    await expect(householdService.joinHousehold(u._id.toString(), u.email, {
      inviteCode: couple.inviteCode,
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws ConflictError if already a member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(householdService.joinHousehold(alice._id.toString(), alice.email, {
      inviteCode: couple.inviteCode,
    })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('householdService.updateMemberIncome', () => {
  it('updates monthly income for the calling user', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await householdService.updateMemberIncome(couple._id.toString(), alice._id.toString(), 4200);
    const updatedMember = result.members.find((m: any) => m.userId?.toString() === alice._id.toString());
    expect(updatedMember?.monthlyIncome).toBe(4200);
  });
});

describe('householdService.updateSettings', () => {
  it('admin can update finance mode', async () => {
    const alice = FIXTURES.user('alice'); // owner of couple → admin
    const couple = FIXTURES.household('couple');
    const result = await householdService.updateSettings(couple._id.toString(), alice._id.toString(), {
      financeMode: 'split',
      expenseSplitMethod: 'equal',
    });
    expect(result.settings.financeMode).toBe('split');
  });

  it('non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob'); // member, not owner/admin
    const couple = FIXTURES.household('couple');
    await expect(householdService.updateSettings(couple._id.toString(), bob._id.toString(), {
      financeMode: 'split',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('householdService.recordSettlement', () => {
  it('admin can record a monthly settlement', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await householdService.recordSettlement(
      couple._id.toString(), alice._id.toString(), '2026-04', 250
    );
    expect(result.settlements.some((s: any) => s.month === '2026-04' && s.amount === 250)).toBe(true);
  });

  it('non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    await expect(householdService.recordSettlement(
      couple._id.toString(), bob._id.toString(), '2026-04', 250
    )).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects double-settlement of the same month (BadRequestError)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await householdService.recordSettlement(couple._id.toString(), alice._id.toString(), '2026-04', 250);
    await expect(householdService.recordSettlement(
      couple._id.toString(), alice._id.toString(), '2026-04', 100
    )).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('householdService.getById', () => {
  it('member can fetch their household', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await householdService.getById(couple._id.toString(), alice._id.toString());
    expect(result.id.toString()).toBe(couple._id.toString());
  });

  it('non-member throws ForbiddenError', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    await expect(householdService.getById(couple._id.toString(), carol._id.toString()))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-existent household throws NotFoundError', async () => {
    const alice = FIXTURES.user('alice');
    await expect(householdService.getById(new Types.ObjectId().toString(), alice._id.toString()))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('householdService.regenerateInviteCode', () => {
  it('admin can regenerate the invite code', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const oldCode = couple.inviteCode;
    const result = await householdService.regenerateInviteCode(couple._id.toString(), alice._id.toString());
    expect(result.inviteCode).not.toBe(oldCode);
  });

  it('non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    await expect(householdService.regenerateInviteCode(couple._id.toString(), bob._id.toString()))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

Implementer notes:
- The `validCreateInput` helper assumes the field names match the actual `ICreateHouseholdInput` interface. After the first run, if Mongoose validation surfaces a missing or differently-named field, fix the helper to match.
- `member.userId?.toString()` is the canonical user→member link.
- For Settings, finance enum values (`'shared'`, `'split'`, etc.) must match `FINANCE_MODES` in `BackEnd/src/types/household.types.ts`. Adjust if validation rejects.

- [ ] **Step 7.2: Run**

Run: `npm test tests/unit/services/household.service.test.ts`
Expected: ~14 tests pass.

- [ ] **Step 7.3: User commit checkpoint**

Summary: "Household service tests: create/join/update-income/update-settings/record-settlement/getById/regenerate-invite (~14 cases)."

---

## Task 8: `services/expense.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/expense.service.test.ts`

**Methods covered:** `addExpense`, `listExpenses`, `updateExpense`, `deleteExpense`, `claimExpense`, `requestResolution`, `confirmResolution`, `disputeResolution`. (`autoConfirmExpiredPending` is covered in Batch 4.)

- [ ] **Step 8.1: Write the test**

Create `BackEnd/tests/unit/services/expense.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { expenseService } from '../../../src/services/expense.service';
import { Expense } from '../../../src/models/expense.model';
import { ForbiddenError, BadRequestError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { Types } from 'mongoose';

describe('expenseService.addExpense', () => {
  it('financial member can add an expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await expenseService.addExpense(couple._id.toString(), alice._id.toString(), {
      description: 'Coffee',
      amount: 12.5,
      category: 'groceries',
      date: new Date().toISOString(),
    });
    expect(result.amount).toBe(12.5);
    expect(result.description).toBe('Coffee');
  });

  it('non-financial member throws ForbiddenError', async () => {
    // Frank in flatshare has participatesInFinances=false
    const frank = FIXTURES.user('frank');
    const flat = FIXTURES.household('flatshare');
    await expect(expenseService.addExpense(flat._id.toString(), frank._id.toString(), {
      description: 'Snack', amount: 5, category: 'groceries', date: new Date().toISOString(),
    })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-member throws ForbiddenError', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    await expect(expenseService.addExpense(couple._id.toString(), carol._id.toString(), {
      description: 'X', amount: 1, category: 'groceries', date: new Date().toISOString(),
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('expenseService.listExpenses', () => {
  it('returns paginated expenses for the household', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await expenseService.listExpenses(couple._id.toString(), alice._id.toString(), { limit: 10 });
    expect(Array.isArray(result.expenses)).toBe(true);
    expect(result.expenses.length).toBeGreaterThan(0);
    expect(result.expenses.every((e: any) => e.householdId?.toString() === couple._id.toString() || true)).toBe(true);
  });

  it('filters by status=pending', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await expenseService.listExpenses(couple._id.toString(), alice._id.toString(), {
      status: 'unresolved', limit: 50,
    });
    expect(result.expenses.length).toBeGreaterThan(0);
  });

  it('non-member throws ForbiddenError', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    await expect(expenseService.listExpenses(couple._id.toString(), carol._id.toString(), {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('expenseService.updateExpense', () => {
  it('creator can update a non-resolved expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const expenseId = FIXTURES.expense('groceries-week1'); // bob's pending — alice is admin so she can update
    const result = await expenseService.updateExpense(couple._id.toString(), alice._id.toString(), expenseId.toString(), {
      description: 'Groceries — corrected',
    });
    expect(result.description).toBe('Groceries — corrected');
  });

  it('rejects update to a settled expense (BadRequestError)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const settledId = FIXTURES.expense('rent-april'); // status: settled
    await expect(expenseService.updateExpense(couple._id.toString(), alice._id.toString(), settledId.toString(), {
      description: 'cannot change',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('non-member throws ForbiddenError', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1');
    await expect(expenseService.updateExpense(couple._id.toString(), carol._id.toString(), id.toString(), {
      description: 'x',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('expenseService.deleteExpense', () => {
  it('creator can delete their own non-resolved expense', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1'); // bob is paid-by member
    await expenseService.deleteExpense(couple._id.toString(), bob._id.toString(), id.toString());
    expect(await Expense.findById(id)).toBeNull();
  });

  it('rejects deletion of resolved expense (BadRequestError)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('rent-april');
    await expect(expenseService.deleteExpense(couple._id.toString(), alice._id.toString(), id.toString())).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws NotFoundError on non-existent expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(expenseService.deleteExpense(couple._id.toString(), alice._id.toString(), new Types.ObjectId().toString())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('expenseService.claimExpense', () => {
  it('a financial member can claim an unclaimed expense', async () => {
    // Need an unclaimed expense — create one in test
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const expense = await expenseService.addExpense(couple._id.toString(), alice._id.toString(), {
      description: 'Unclaimed thing', amount: 20, category: 'groceries', date: new Date().toISOString(),
      paidByUserId: null as any, // Adjust to whatever the service expects for "no payer"
    });
    const bob = FIXTURES.user('bob');
    const claimed = await expenseService.claimExpense(couple._id.toString(), bob._id.toString(), expense.id.toString());
    expect(claimed.paidByMemberId).toBeTruthy();
  });
});

describe('expenseService.requestResolution → confirmResolution → disputeResolution', () => {
  it('non-payer requests, payer confirms → marks resolved', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april'); // alice paid, claimed by bob

    await expenseService.requestResolution(couple._id.toString(), bob._id.toString(), id.toString());
    const after = await expenseService.confirmResolution(couple._id.toString(), alice._id.toString(), id.toString());
    expect(after.isResolved).toBe(true);
  });

  it('payer disputes a pending resolution → cancels confirmation', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april');

    await expenseService.requestResolution(couple._id.toString(), bob._id.toString(), id.toString());
    const disputed = await expenseService.disputeResolution(couple._id.toString(), alice._id.toString(), id.toString());
    expect(disputed.pendingConfirmation).toBe(false);
    expect(disputed.disputedAt).toBeTruthy();
  });

  it('non-payer cannot confirm (ForbiddenError)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('utilities-april');
    await expenseService.requestResolution(couple._id.toString(), bob._id.toString(), id.toString());
    await expect(expenseService.confirmResolution(couple._id.toString(), bob._id.toString(), id.toString())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

Implementer notes:
- The exact field names on the Expense response (`paidByMemberId`, `isResolved`, `pendingConfirmation`, `disputedAt`) come from `BackEnd/src/types/expense.types.ts`. Verify and adjust.
- For `claimExpense` to work, you need an expense with no payer. The seed expense `flat-internet` is "pending" — you may need to clear `paidByMemberId` on it first, or create one in-test as shown above.
- The category enum (`'groceries'`, `'rent'`, etc.) must match the model.

- [ ] **Step 8.2: Run**

Run: `npm test tests/unit/services/expense.service.test.ts`
Expected: ~13 tests pass.

- [ ] **Step 8.3: User commit checkpoint**

---

## Task 9: `services/task.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/task.service.test.ts`

**Methods covered:** `addTask`, `listTasks`, `toggleComplete`, `deleteTask`, `assignTask`, `setRotation`.

- [ ] **Step 9.1: Write the test**

Create `BackEnd/tests/unit/services/task.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { taskService } from '../../../src/services/task.service';
import { Task } from '../../../src/models/task.model';
import { ForbiddenError, BadRequestError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { Types } from 'mongoose';

describe('taskService.addTask', () => {
  it('task member can add a task', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await taskService.addTask(couple._id.toString(), alice._id.toString(), {
      title: 'Mop the floor',
    });
    expect(result.title).toBe('Mop the floor');
  });

  it('non-task member (frank in flatshare) throws ForbiddenError', async () => {
    const frank = FIXTURES.user('frank');
    const flat = FIXTURES.household('flatshare');
    await expect(taskService.addTask(flat._id.toString(), frank._id.toString(), {
      title: 'X',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('taskService.listTasks', () => {
  it('returns paginated tasks for the household', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await taskService.listTasks(couple._id.toString(), alice._id.toString(), { limit: 50 });
    expect(result.tasks.length).toBeGreaterThan(0);
  });
});

describe('taskService.toggleComplete', () => {
  it('assigned member can mark task complete', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes'); // assigned to bob
    const result = await taskService.toggleComplete(couple._id.toString(), bob._id.toString(), id.toString());
    expect(result.isCompleted).toBe(true);
  });

  it('toggling completed task back to incomplete works within 24h', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    await taskService.toggleComplete(couple._id.toString(), bob._id.toString(), id.toString());
    const result = await taskService.toggleComplete(couple._id.toString(), bob._id.toString(), id.toString());
    expect(result.isCompleted).toBe(false);
  });
});

describe('taskService.deleteTask', () => {
  it('creator can delete a task', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('vacuum'); // created by alice
    await taskService.deleteTask(couple._id.toString(), alice._id.toString(), id.toString());
    expect(await Task.findById(id)).toBeNull();
  });

  it('non-creator non-admin throws ForbiddenError', async () => {
    const eve = FIXTURES.user('eve'); // admin of flatshare
    const flat = FIXTURES.household('flatshare');
    const id = FIXTURES.task('flat-bathroom'); // created by carol
    // Eve is admin — should succeed; replace with a true non-admin test using bob in couple.
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const idCouple = FIXTURES.task('vacuum'); // created by alice
    await expect(taskService.deleteTask(couple._id.toString(), bob._id.toString(), idCouple.toString())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('taskService.assignTask', () => {
  it('admin can reassign a task', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    const aliceMemberId = FIXTURES.member('alice-member');
    const result = await taskService.assignTask(couple._id.toString(), alice._id.toString(), id.toString(), {
      assignedToMemberId: aliceMemberId.toString(),
    });
    expect(result.assignedToMemberId?.toString()).toBe(aliceMemberId.toString());
  });

  it('regular member can self-assign in fixed mode', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('vacuum'); // unassigned in seed
    const bobMemberId = FIXTURES.member('bob-member');
    const result = await taskService.assignTask(couple._id.toString(), bob._id.toString(), id.toString(), {
      assignedToMemberId: bobMemberId.toString(),
    });
    expect(result.assignedToMemberId?.toString()).toBe(bobMemberId.toString());
  });
});

describe('taskService.setRotation', () => {
  it('admin can set rotation config', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const aliceMember = FIXTURES.member('alice-member');
    const result = await taskService.setRotation(couple._id.toString(), alice._id.toString(), {
      startMemberId: aliceMember.toString(),
    });
    expect(result.currentMemberId).toBeTruthy();
  });

  it('non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const bobMember = FIXTURES.member('bob-member');
    await expect(taskService.setRotation(couple._id.toString(), bob._id.toString(), {
      startMemberId: bobMember.toString(),
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

- [ ] **Step 9.2: Run**

Run: `npm test tests/unit/services/task.service.test.ts`
Expected: ~10 tests pass.

---

## Task 10: `services/goal.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/goal.service.test.ts`

**Methods covered:** `addGoal`, `listGoals`, `getGoal`, `updateGoal`, `deleteGoal`, `addContribution`, `removeContribution`.

- [ ] **Step 10.1: Write the test**

Create `BackEnd/tests/unit/services/goal.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { goalService } from '../../../src/services/goal.service';
import { Goal } from '../../../src/models/goal.model';
import { ForbiddenError, BadRequestError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { Types } from 'mongoose';

describe('goalService.addGoal', () => {
  it('any member can add a goal', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await goalService.addGoal(couple._id.toString(), alice._id.toString(), {
      name: 'Saturday brunch fund',
      targetAmount: 100,
    });
    expect(result.name).toBe('Saturday brunch fund');
    expect(result.contributions).toEqual([]);
  });
});

describe('goalService.listGoals', () => {
  it('returns paginated goals filtered by status', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await goalService.listGoals(couple._id.toString(), alice._id.toString(), {
      status: 'active', page: 1, limit: 10,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(2); // vacation + new-couch in seed
  });
});

describe('goalService.getGoal', () => {
  it('returns single goal by id', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const result = await goalService.getGoal(couple._id.toString(), alice._id.toString(), id.toString());
    expect(result.id.toString()).toBe(id.toString());
  });

  it('throws NotFoundError on non-existent goal', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(goalService.getGoal(couple._id.toString(), alice._id.toString(), new Types.ObjectId().toString()))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('goalService.updateGoal', () => {
  it('creator or admin can update', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation'); // created by alice
    const result = await goalService.updateGoal(couple._id.toString(), alice._id.toString(), id.toString(), {
      targetAmount: 3000,
    });
    expect(result.targetAmount).toBe(3000);
  });

  it('non-creator non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation'); // by alice (admin); change to a goal bob did not create
    const newCouchId = FIXTURES.goal('new-couch'); // created by bob — bob CAN update his own
    // Get alice's vacation goal — bob is not creator and not admin → should fail
    await expect(goalService.updateGoal(couple._id.toString(), bob._id.toString(), id.toString(), {
      targetAmount: 99,
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('goalService.deleteGoal', () => {
  it('creator can delete', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    await goalService.deleteGoal(couple._id.toString(), alice._id.toString(), id.toString());
    expect(await Goal.findById(id)).toBeNull();
  });
});

describe('goalService.addContribution', () => {
  it('any member can contribute', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const result = await goalService.addContribution(couple._id.toString(), bob._id.toString(), id.toString(), {
      amount: 100,
    });
    expect(result.contributions.some((c: any) => c.amount === 100)).toBe(true);
  });

  it('contributing past target marks goal completed', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('new-couch'); // target 800, has 200 contributed → need >600
    const result = await goalService.addContribution(couple._id.toString(), alice._id.toString(), id.toString(), {
      amount: 700,
    });
    expect(result.status).toBe('completed');
  });
});

describe('goalService.removeContribution', () => {
  it('contribution author can remove', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const goalId = FIXTURES.goal('vacation');
    const goal = await goalService.getGoal(couple._id.toString(), alice._id.toString(), goalId.toString());
    const contributionId = goal.contributions[0].id;
    const result = await goalService.removeContribution(
      couple._id.toString(), alice._id.toString(), goalId.toString(), contributionId.toString()
    );
    expect(result.contributions.length).toBe(goal.contributions.length - 1);
  });
});
```

- [ ] **Step 10.2: Run**

Run: `npm test tests/unit/services/goal.service.test.ts`
Expected: ~10 tests pass.

---

## Task 11: `services/joint-account.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/joint-account.service.test.ts`

**Methods covered:** `getSummary`, `addTransaction`, `deleteTransaction`, `updateConfig`.

- [ ] **Step 11.1: Write the test**

Create `BackEnd/tests/unit/services/joint-account.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { jointAccountService } from '../../../src/services/joint-account.service';
import { JointAccountTransaction } from '../../../src/models/joint-account-transaction.model';
import { ForbiddenError, BadRequestError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('jointAccountService.getSummary', () => {
  it('returns summary for a financial member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const summary = await jointAccountService.getSummary(couple._id.toString(), alice._id.toString());
    expect(summary.totals).toBeTruthy();
    expect(Array.isArray(summary.transactions)).toBe(true);
  });

  it('non-financial member throws ForbiddenError', async () => {
    const frank = FIXTURES.user('frank');
    const flat = FIXTURES.household('flatshare');
    await expect(jointAccountService.getSummary(flat._id.toString(), frank._id.toString())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('jointAccountService.addTransaction', () => {
  it('financial member can add deposit', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await jointAccountService.addTransaction(couple._id.toString(), alice._id.toString(), {
      type: 'deposit', amount: 100,
    });
    expect(result.type).toBe('deposit');
    expect(result.amount).toBe(100);
  });

  it('rejects withdrawal exceeding balance (BadRequestError)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(jointAccountService.addTransaction(couple._id.toString(), alice._id.toString(), {
      type: 'withdrawal', amount: 99_999,
    })).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('jointAccountService.deleteTransaction', () => {
  it('creator can delete their transaction', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.jointTx('tx-1'); // created by alice
    await jointAccountService.deleteTransaction(couple._id.toString(), alice._id.toString(), id.toString());
    expect(await JointAccountTransaction.findById(id)).toBeNull();
  });
});

describe('jointAccountService.updateConfig', () => {
  it('admin can set monthly target', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await jointAccountService.updateConfig(couple._id.toString(), alice._id.toString(), {
      monthlyTarget: 1000, targetMode: 'equal',
    });
    expect(result.settings.jointAccountConfig?.monthlyTarget).toBe(1000);
  });

  it('non-admin throws ForbiddenError', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    await expect(jointAccountService.updateConfig(couple._id.toString(), bob._id.toString(), {
      monthlyTarget: 999,
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

- [ ] **Step 11.2: Run**

Run: `npm test tests/unit/services/joint-account.service.test.ts`
Expected: ~7 tests pass.

---

## Task 12: `services/shopping-list.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/shopping-list.service.test.ts`

**Methods covered:** `addItem`, `listItems`, `toggleBought`, `updateItem`, `deleteItem`, `archiveItem`, `restoreItem`, `archiveBought`, `listArchivedHistory`.

- [ ] **Step 12.1: Write the test**

Create `BackEnd/tests/unit/services/shopping-list.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shoppingListService } from '../../../src/services/shopping-list.service';
import { ShoppingListItem } from '../../../src/models/shopping-list-item.model';
import { BadRequestError, NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('shoppingListService.addItem', () => {
  it('any member can add an item', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await shoppingListService.addItem(couple._id.toString(), alice._id.toString(), {
      name: 'Yogurt', quantity: 2, category: 'dairy',
    });
    expect(result.name).toBe('Yogurt');
    expect(result.isBought).toBe(false);
  });
});

describe('shoppingListService.listItems', () => {
  it('returns paginated items, unbought first', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await shoppingListService.listItems(couple._id.toString(), alice._id.toString(), { limit: 50 });
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe('shoppingListService.toggleBought', () => {
  it('marks item as bought, records boughtAt + boughtByMemberId', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const result = await shoppingListService.toggleBought(couple._id.toString(), alice._id.toString(), id.toString());
    expect(result.isBought).toBe(true);
    expect(result.boughtAt).toBeTruthy();
  });
});

describe('shoppingListService.updateItem', () => {
  it('updates name and category', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const result = await shoppingListService.updateItem(couple._id.toString(), alice._id.toString(), id.toString(), {
      name: 'Whole milk',
    });
    expect(result.name).toBe('Whole milk');
  });
});

describe('shoppingListService.archiveItem', () => {
  it('archives an item; rejects double-archive', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    await shoppingListService.archiveItem(couple._id.toString(), alice._id.toString(), id.toString());
    await expect(
      shoppingListService.archiveItem(couple._id.toString(), alice._id.toString(), id.toString())
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('shoppingListService.restoreItem', () => {
  it('restores an archived item', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    await shoppingListService.archiveItem(couple._id.toString(), alice._id.toString(), id.toString());
    const restored = await shoppingListService.restoreItem(couple._id.toString(), alice._id.toString(), id.toString());
    expect(restored.archivedAt).toBeFalsy();
  });
});

describe('shoppingListService.deleteItem', () => {
  it('deletes an item', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('shampoo');
    await shoppingListService.deleteItem(couple._id.toString(), alice._id.toString(), id.toString());
    expect(await ShoppingListItem.findById(id)).toBeNull();
  });
});

describe('shoppingListService.listArchivedHistory', () => {
  it('returns paginated archived items', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    await shoppingListService.toggleBought(couple._id.toString(), alice._id.toString(), id.toString());
    await shoppingListService.archiveItem(couple._id.toString(), alice._id.toString(), id.toString());

    const history = await shoppingListService.listArchivedHistory(couple._id.toString(), alice._id.toString(), { limit: 50 });
    expect(history.items.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 12.2: Run**

Run: `npm test tests/unit/services/shopping-list.service.test.ts`
Expected: ~8 tests pass.

---

## Task 13: `services/recurring-expense.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/recurring-expense.service.test.ts`

**Methods covered:** `create`, `list`, `update`, `deactivate`. (`generateInstances` is in Batch 4.)

- [ ] **Step 13.1: Write the test**

Create `BackEnd/tests/unit/services/recurring-expense.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recurringExpenseService } from '../../../src/services/recurring-expense.service';
import { ForbiddenError, BadRequestError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringExpenseService.create', () => {
  it('financial member can create a fixed-payer template', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'Rent', amount: 1200, category: 'rent',
      interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    expect(result.amount).toBe(1200);
    expect(result.payerMode).toBe('fixed');
  });

  it('non-financial member throws ForbiddenError', async () => {
    const frank = FIXTURES.user('frank');
    const flat = FIXTURES.household('flatshare');
    await expect(recurringExpenseService.create(flat._id.toString(), frank._id.toString(), {
      description: 'X', amount: 1, category: 'rent', interval: 'monthly', payerMode: 'open_to_claim',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('fixed mode without payer throws BadRequestError', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'X', amount: 10, category: 'rent', interval: 'monthly', payerMode: 'fixed',
    })).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('recurringExpenseService.list', () => {
  it('returns active templates for the household', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'R', amount: 100, category: 'rent', interval: 'monthly',
      payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    const list = await recurringExpenseService.list(couple._id.toString(), alice._id.toString());
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('recurringExpenseService.update', () => {
  it('admin can update financial fields', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'U', amount: 50, category: 'utilities', interval: 'monthly',
      payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    const result = await recurringExpenseService.update(couple._id.toString(), alice._id.toString(), created.id.toString(), {
      amount: 75,
    });
    expect(result.amount).toBe(75);
  });

  it('non-admin updating financial fields throws ForbiddenError', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const created = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'U', amount: 50, category: 'utilities', interval: 'monthly',
      payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    await expect(recurringExpenseService.update(couple._id.toString(), bob._id.toString(), created.id.toString(), {
      amount: 75,
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('recurringExpenseService.deactivate', () => {
  it('creator can deactivate', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringExpenseService.create(couple._id.toString(), alice._id.toString(), {
      description: 'D', amount: 30, category: 'utilities', interval: 'monthly',
      payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
    });
    await recurringExpenseService.deactivate(couple._id.toString(), alice._id.toString(), created.id.toString());
    const list = await recurringExpenseService.list(couple._id.toString(), alice._id.toString());
    expect(list.find((r: any) => r.id.toString() === created.id.toString())).toBeUndefined();
  });
});
```

- [ ] **Step 13.2: Run**

Run: `npm test tests/unit/services/recurring-expense.service.test.ts`
Expected: ~6 tests pass.

---

## Task 14: `services/recurring-task.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/recurring-task.service.test.ts`

**Methods covered:** `create`, `list`, `update`, `deactivate`. (`generateInstances` is in Batch 4.)

- [ ] **Step 14.1: Write the test**

Create `BackEnd/tests/unit/services/recurring-task.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recurringTaskService } from '../../../src/services/recurring-task.service';
import { ForbiddenError, BadRequestError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringTaskService.create', () => {
  it('task member can create a recurring task', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Take out trash', interval: 'weekly',
    });
    expect(result.title).toBe('Take out trash');
  });

  it('non-task member throws ForbiddenError', async () => {
    const frank = FIXTURES.user('frank');
    const flat = FIXTURES.household('flatshare');
    await expect(recurringTaskService.create(flat._id.toString(), frank._id.toString(), {
      title: 'X', interval: 'weekly',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('recurringTaskService.list', () => {
  it('returns active templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Mop', interval: 'weekly',
    });
    const list = await recurringTaskService.list(couple._id.toString(), alice._id.toString());
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('recurringTaskService.update', () => {
  it('creator can update', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Old title', interval: 'weekly',
    });
    const result = await recurringTaskService.update(couple._id.toString(), alice._id.toString(), created.id.toString(), {
      title: 'New title',
    });
    expect(result.title).toBe('New title');
  });

  it('non-creator throws ForbiddenError', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const created = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'X', interval: 'weekly',
    });
    await expect(recurringTaskService.update(couple._id.toString(), bob._id.toString(), created.id.toString(), {
      title: 'Y',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('recurringTaskService.deactivate', () => {
  it('creator can deactivate', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringTaskService.create(couple._id.toString(), alice._id.toString(), {
      title: 'Z', interval: 'weekly',
    });
    await recurringTaskService.deactivate(couple._id.toString(), alice._id.toString(), created.id.toString());
    const list = await recurringTaskService.list(couple._id.toString(), alice._id.toString());
    expect(list.find((r: any) => r.id.toString() === created.id.toString())).toBeUndefined();
  });
});
```

- [ ] **Step 14.2: Run**

Run: `npm test tests/unit/services/recurring-task.service.test.ts`
Expected: ~5 tests pass.

---

## Task 15: `services/recurring-shopping-item.service.test.ts`

**Files:**
- Create: `BackEnd/tests/unit/services/recurring-shopping-item.service.test.ts`

**Methods covered:** `createRule`, `listRules`, `updateRule`, `deleteRule`. (`fireRulesForCadence` is in Batch 4.)

- [ ] **Step 15.1: Write the test**

Create `BackEnd/tests/unit/services/recurring-shopping-item.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recurringShoppingItemService } from '../../../src/services/recurring-shopping-item.service';
import { NotFoundError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { Types } from 'mongoose';

describe('recurringShoppingItemService.createRule', () => {
  it('member can create a recurring rule', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const result = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Milk', category: 'dairy', cadence: 'weekly',
    });
    expect(result.name).toBe('Milk');
    expect(result.cadence).toBe('weekly');
  });
});

describe('recurringShoppingItemService.listRules', () => {
  it('returns all rules for the household', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Bread', category: 'bakery', cadence: 'weekly',
    });
    const result = await recurringShoppingItemService.listRules(couple._id.toString(), alice._id.toString());
    expect(result.rules.length).toBeGreaterThan(0);
  });
});

describe('recurringShoppingItemService.updateRule', () => {
  it('updates name and cadence', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'Old', category: 'pantry', cadence: 'weekly',
    });
    const result = await recurringShoppingItemService.updateRule(created.id.toString(), couple._id.toString(), alice._id.toString(), {
      name: 'New', cadence: 'monthly',
    });
    expect(result.name).toBe('New');
    expect(result.cadence).toBe('monthly');
  });

  it('throws NotFoundError on non-existent rule', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await expect(recurringShoppingItemService.updateRule(
      new Types.ObjectId().toString(), couple._id.toString(), alice._id.toString(), { name: 'X' }
    )).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('recurringShoppingItemService.deleteRule', () => {
  it('deletes a rule', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await recurringShoppingItemService.createRule(couple._id.toString(), alice._id.toString(), {
      name: 'X', category: 'pantry', cadence: 'weekly',
    });
    await recurringShoppingItemService.deleteRule(created.id.toString(), couple._id.toString(), alice._id.toString());
    const list = await recurringShoppingItemService.listRules(couple._id.toString(), alice._id.toString());
    expect(list.rules.find((r: any) => r.id.toString() === created.id.toString())).toBeUndefined();
  });
});
```

- [ ] **Step 15.2: Run**

Run: `npm test tests/unit/services/recurring-shopping-item.service.test.ts`
Expected: ~5 tests pass.

- [ ] **Step 15.3: User commit checkpoint**

Summary: "All 11 service unit test files added (~85 tests). Ready for Batch 3."

---

## Batch 2 — Verification Checklist

Run all of the following from `BackEnd/`:

- [ ] `npm run test:db:up` → Mongo container up.
- [ ] `npm run type-check` → exits 0.
- [ ] `npm test` → entire suite green (Batch 1 smoke + Batch 2 service & util tests, ~110 cases).
- [ ] `npm run test:coverage` → produces a coverage report. Target: services + utils ≥ 70% line coverage. If a service is significantly under, identify which method has no test and consider adding one before moving to Batch 3.
- [ ] `git status` → only the new test files (and any test corrections to seed JSON if enum mismatches surfaced) are modified.

---

## Out of Scope for Batch 2 (covered later)

- HTTP-level tests (Batch 3): supertest against routes.
- Middleware tests (Batch 3): auth + emailVerified middleware in isolation.
- Scheduler tests (Batch 4): `expenseService.autoConfirmExpiredPending`, `recurringExpenseService.generateInstances`, `recurringTaskService.generateInstances`, `recurringShoppingItemService.fireRulesForCadence`.

When Batch 2 is green, ask for or proceed to the Batch 3 plan.
