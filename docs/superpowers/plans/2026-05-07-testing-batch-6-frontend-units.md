# Testing — Batch 6: Frontend Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Batch 5 (Frontend Foundation) complete and green.

**Goal:** Unit-test the leaves of the frontend: custom hooks, util functions, the axios refresh-token interceptor (the most complex piece on the frontend), and Zod validation schemas.

**Architecture:** All tests live in co-located `__tests__/` folders. Hook tests use `renderHook` from `@testing-library/react`. Util tests are pure-function unit tests. Schema tests use Zod's `safeParse` to assert accepted/rejected inputs. The axios interceptor test uses MSW to simulate 401/403 responses and watches what the interceptor does next.

**Tech Stack:** Same as Batch 5. No new dependencies.

**User commit policy:** **"User commit checkpoint"** = stop, summarise, wait for the user to commit.

---

## File Structure

### Files to create

| Task | File |
|------|------|
| 1 | `FrontEnd/src/utils/__tests__/extractApiError.test.ts` |
| 2 | `FrontEnd/src/utils/__tests__/dashboardHelpers.test.ts` |
| 3 | `FrontEnd/src/lib/__tests__/utils.test.ts` (`cn`) |
| 4 | `FrontEnd/src/hooks/__tests__/useDebouncedValue.test.ts` |
| 5 | `FrontEnd/src/hooks/__tests__/useBeforeUnload.test.ts` |
| 6 | `FrontEnd/src/hooks/__tests__/useAuth.test.tsx` |
| 7 | `FrontEnd/src/hooks/__tests__/useTheme.test.tsx` |
| 8 | `FrontEnd/src/utils/__tests__/axios.test.ts` *(the focused interceptor test)* |
| 9 | `FrontEnd/src/schemas/__tests__/auth.schemas.test.ts` |
| 10 | `FrontEnd/src/schemas/__tests__/household.schemas.test.ts` |
| 11 | `FrontEnd/src/schemas/__tests__/onboarding.schemas.test.ts` |
| 12 | `FrontEnd/src/schemas/__tests__/user.schemas.test.ts` |

---

## Task 1: `extractApiError.test.ts`

**Files:**
- Create: `FrontEnd/src/utils/__tests__/extractApiError.test.ts`

- [ ] **Step 1.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import { extractApiError } from '../extractApiError';
import axios from 'axios';

describe('extractApiError', () => {
  it('returns the message from an axios error response', () => {
    const err = {
      isAxiosError: true,
      response: { data: { message: 'Email already in use' } },
    };
    expect(extractApiError(err, 'fallback')).toBe('Email already in use');
  });

  it('returns fallback when error has no axios shape', () => {
    expect(extractApiError(new Error('plain'), 'Something went wrong')).toBe('Something went wrong');
  });

  it('returns fallback when message is missing', () => {
    const err = { isAxiosError: true, response: { data: {} } };
    expect(extractApiError(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback for non-error values', () => {
    expect(extractApiError(undefined, 'F')).toBe('F');
    expect(extractApiError('string', 'F')).toBe('F');
    expect(extractApiError(null, 'F')).toBe('F');
  });
});
```

- [ ] **Step 1.2: Run**

Run: `npm test src/utils/__tests__/extractApiError.test.ts`
Expected: 4 tests pass.

---

## Task 2: `dashboardHelpers.test.ts`

**Files:**
- Create: `FrontEnd/src/utils/__tests__/dashboardHelpers.test.ts`

- [ ] **Step 2.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import {
  fmt,
  stepMonth,
  formatMonthLabel,
  currentMonthString,
  getDueDateStatus,
  formatDueDate,
} from '../dashboardHelpers';

describe('fmt', () => {
  it('formats integers without decimals', () => {
    expect(fmt(1200)).toBe('1,200');
  });
  it('formats up to 2 decimals', () => {
    expect(fmt(12.345)).toBe('12.35');
  });
  it('rounds to 2 decimals', () => {
    expect(fmt(12.4)).toBe('12.4');
  });
});

describe('stepMonth', () => {
  it('moves forward', () => {
    expect(stepMonth('2026-04', 'next')).toBe('2026-05');
  });
  it('moves backward across year boundary', () => {
    expect(stepMonth('2026-01', 'prev')).toBe('2025-12');
  });
});

describe('formatMonthLabel', () => {
  it('formats a YYYY-MM string to a human label', () => {
    expect(formatMonthLabel('2026-05')).toMatch(/May 2026/);
  });
});

describe('currentMonthString', () => {
  it('returns YYYY-MM for the current month', () => {
    expect(currentMonthString()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('getDueDateStatus', () => {
  it('returns "none" when dueDate is undefined', () => {
    expect(getDueDateStatus(undefined, false)).toBe('none');
  });
  it('returns "overdue" for a past date on incomplete task', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, false)).toBe('overdue');
  });
  it('returns "due-today" for today', () => {
    expect(getDueDateStatus(new Date().toISOString(), false)).toBe('due-today');
  });
  it('returns "upcoming" for a future date', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(tomorrow, false)).toBe('upcoming');
  });
  it('returns "none" for completed tasks regardless of date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, true)).toBe('none');
  });
});

describe('formatDueDate', () => {
  it('returns a non-empty human-readable string', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(formatDueDate(tomorrow)).toBeTypeOf('string');
    expect(formatDueDate(tomorrow).length).toBeGreaterThan(0);
  });
});
```

Notes:
- The exact strings produced by `formatMonthLabel` and `formatDueDate` may differ depending on locale settings. The assertions above are loose (regex/length-only) on purpose.

- [ ] **Step 2.2: Run**

Run: `npm test src/utils/__tests__/dashboardHelpers.test.ts`
Expected: ~14 tests pass.

---

## Task 3: `cn` (lib/utils)

**Files:**
- Create: `FrontEnd/src/lib/__tests__/utils.test.ts`

- [ ] **Step 3.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
  it('resolves tailwind conflicts (twMerge)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
  it('handles conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });
});
```

- [ ] **Step 3.2: Run**

Run: `npm test src/lib/__tests__/utils.test.ts`
Expected: 4 tests pass.

---

## Task 4: `useDebouncedValue.test.ts`

**Files:**
- Create: `FrontEnd/src/hooks/__tests__/useDebouncedValue.test.ts`

- [ ] **Step 4.1: Write**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 200));
    expect(result.current).toBe('hello');
  });

  it('lags subsequent updates by the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    vi.advanceTimersByTime(199);
    expect(result.current).toBe('a');

    vi.advanceTimersByTime(1);
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    vi.advanceTimersByTime(150);
    rerender({ value: 'c' });
    vi.advanceTimersByTime(150);
    expect(result.current).toBe('a');
    vi.advanceTimersByTime(50);
    expect(result.current).toBe('c');
  });
});
```

- [ ] **Step 4.2: Run**

Run: `npm test src/hooks/__tests__/useDebouncedValue.test.ts`
Expected: 3 tests pass.

---

## Task 5: `useBeforeUnload.test.ts`

**Files:**
- Create: `FrontEnd/src/hooks/__tests__/useBeforeUnload.test.ts`

- [ ] **Step 5.1: Write**

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from '../useBeforeUnload';

describe('useBeforeUnload', () => {
  it('attaches a beforeunload listener when active=true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useBeforeUnload(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('does NOT attach a listener when active=false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useBeforeUnload(false));
    const calls = addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload');
    expect(calls).toHaveLength(0);
    addSpy.mockRestore();
  });

  it('removes the listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBeforeUnload(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    removeSpy.mockRestore();
  });
});
```

- [ ] **Step 5.2: Run**

Run: `npm test src/hooks/__tests__/useBeforeUnload.test.ts`
Expected: 3 tests pass.

---

## Task 6: `useAuth.test.tsx`

**Files:**
- Create: `FrontEnd/src/hooks/__tests__/useAuth.test.tsx`

- [ ] **Step 6.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthProvider } from '../../contexts/AuthContext';

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // renderHook surfaces hook errors as the first call to result.current — wrap in try/catch.
    expect(() => renderHook(() => useAuth())).toThrow();
  });

  it('returns context value when used inside AuthProvider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      // Initial silent-refresh resolves and isLoading flips to false
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull(); // default refresh handler returns 401 → no session
    expect(typeof result.current.login).toBe('function');
  });
});
```

- [ ] **Step 6.2: Run**

Run: `npm test src/hooks/__tests__/useAuth.test.tsx`
Expected: 2 tests pass.

---

## Task 7: `useTheme.test.tsx`

**Files:**
- Create: `FrontEnd/src/hooks/__tests__/useTheme.test.tsx`

- [ ] **Step 7.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { ThemeProvider } from '../../components/layout/ThemeProvider';

describe('useTheme', () => {
  it('returns theme + setters', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="light" storageKey="test-theme">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(['light', 'dark', 'system']).toContain(result.current.theme);
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.toggleTheme).toBe('function');
  });

  it('setTheme updates the theme value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="light" storageKey="test-theme">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
  });
});
```

Notes:
- The `ThemeProvider` import path is from the spec's "Layout" section (`FrontEnd/src/components/layout/ThemeProvider`). If the import fails, run `grep -RnE "export.*ThemeProvider" FrontEnd/src/` to find the real path.
- `defaultTheme` and `storageKey` props are common; if your provider doesn't accept them, drop them.

- [ ] **Step 7.2: Run**

Run: `npm test src/hooks/__tests__/useTheme.test.tsx`
Expected: 2 tests pass.

---

## Task 8: `axios.test.ts` — focused interceptor test

**Files:**
- Create: `FrontEnd/src/utils/__tests__/axios.test.ts`

This is the highlight test of Batch 6. The interceptor's refresh-queue logic is non-trivial: a single 401 triggers a refresh; parallel 401s queue and replay once; refresh failure logs out + redirects.

- [ ] **Step 8.1: Set up the test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import api, { tokenStorage } from '../axios';

// Capture window.location.href changes (the interceptor uses it for redirects)
let lastHref = '';
beforeEach(() => {
  lastHref = '';
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '', assign: (h: string) => { lastHref = h; } },
  });
  // Override location.href setter
  let _href = '';
  Object.defineProperty(window.location, 'href', {
    get: () => _href,
    set: (v: string) => { _href = v; lastHref = v; },
  });
  tokenStorage.clear();
});

describe('axios refresh-token interceptor', () => {
  it('on 401 → calls /auth/refresh, retries the original request with the new token', async () => {
    const refreshCallSpy = vi.fn();
    let firstCall = true;

    server.use(
      http.get('/api/me-protected', () => {
        if (firstCall) {
          firstCall = false;
          return HttpResponse.json({ status: 'error' }, { status: 401 });
        }
        return HttpResponse.json({ status: 'success', data: { hello: 'world' } });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({
          status: 'success',
          data: { tokens: { accessToken: 'new-access-token', refreshToken: 'new-refresh' } },
        });
      }),
    );

    const result = await api.get('/me-protected');
    expect(result.data.data.hello).toBe('world');
    expect(refreshCallSpy).toHaveBeenCalledOnce();
  });

  it('on refresh failure → clears token and redirects to /login', async () => {
    server.use(
      http.get('/api/me-protected', () => HttpResponse.json({ status: 'error' }, { status: 401 })),
      http.post('/api/auth/refresh', () => HttpResponse.json({ status: 'error' }, { status: 401 })),
    );

    await expect(api.get('/me-protected')).rejects.toThrow();
    expect(lastHref).toBe('/login');
    expect(tokenStorage.get()).toBeNull();
  });

  it('parallel 401s → only ONE refresh call, both requests get the new token', async () => {
    const refreshCallSpy = vi.fn();
    let callsToProtected = 0;

    server.use(
      http.get('/api/me-protected', () => {
        callsToProtected += 1;
        // First two calls return 401 (initial); subsequent (retried) return success.
        if (callsToProtected <= 2) return HttpResponse.json({ status: 'error' }, { status: 401 });
        return HttpResponse.json({ status: 'success', data: { ok: true } });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({
          status: 'success',
          data: { tokens: { accessToken: 'new', refreshToken: 'new-refresh' } },
        });
      }),
    );

    const [a, b] = await Promise.all([api.get('/me-protected'), api.get('/me-protected')]);
    expect(a.data.data.ok).toBe(true);
    expect(b.data.data.ok).toBe(true);
    expect(refreshCallSpy).toHaveBeenCalledOnce();
  });

  it('on 403 with "verify your email" message → redirects to /profile', async () => {
    server.use(
      http.get('/api/me-protected', () => HttpResponse.json(
        { status: 'error', message: 'Please verify your email to access this resource' },
        { status: 403 }
      )),
    );

    await expect(api.get('/me-protected')).rejects.toThrow();
    expect(lastHref).toBe('/profile');
  });
});
```

Notes:
- The interceptor reads `window.location.href = '/login'` (line 119 of `axios.ts`). Our test overrides `window.location` to capture writes.
- The proxy in dev sends `/api/...` paths directly. The `api` instance from `axios.ts` has `baseURL: '/api'`, so `api.get('/me-protected')` actually requests `/api/me-protected` — that's why the MSW handlers use `/api/me-protected`.
- If the test fails with "URL not handled", run a quick `console.log(error.config?.url)` inside one of the handlers to confirm the path.

- [ ] **Step 8.2: Run**

Run: `npm test src/utils/__tests__/axios.test.ts`
Expected: 4 tests pass.

---

## Task 9: `auth.schemas.test.ts`

**Files:**
- Create: `FrontEnd/src/schemas/__tests__/auth.schemas.test.ts`

- [ ] **Step 9.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../auth.schemas';

describe('loginSchema', () => {
  it('accepts valid input', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'Password123!' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-email', password: 'Password123!' }).success).toBe(false);
  });
  it('rejects short password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    expect(registerSchema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'a@b.co',
      password: 'Password123!', confirmPassword: 'Password123!',
    }).success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'a@b.co',
      password: 'Password123!', confirmPassword: 'Different1!',
    });
    expect(result.success).toBe(false);
  });
  it('rejects password without uppercase', () => {
    expect(registerSchema.safeParse({
      firstName: 'A', lastName: 'A', email: 'a@b.co',
      password: 'password1!', confirmPassword: 'password1!',
    }).success).toBe(false);
  });
  it('rejects password without digit', () => {
    expect(registerSchema.safeParse({
      firstName: 'A', lastName: 'A', email: 'a@b.co',
      password: 'Password!', confirmPassword: 'Password!',
    }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching strong passwords', () => {
    expect(resetPasswordSchema.safeParse({
      password: 'Password123!', confirmPassword: 'Password123!',
    }).success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    expect(resetPasswordSchema.safeParse({
      password: 'Password123!', confirmPassword: 'Different1!',
    }).success).toBe(false);
  });
});
```

- [ ] **Step 9.2: Run**

Run: `npm test src/schemas/__tests__/auth.schemas.test.ts`
Expected: ~11 tests pass.

---

## Task 10: `household.schemas.test.ts`

**Files:**
- Create: `FrontEnd/src/schemas/__tests__/household.schemas.test.ts`

- [ ] **Step 10.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import { joinHouseholdSchema } from '../household.schemas';

describe('joinHouseholdSchema', () => {
  it('accepts a UUID invite code', () => {
    expect(joinHouseholdSchema.safeParse({
      inviteCode: '550e8400-e29b-41d4-a716-446655440000',
    }).success).toBe(true);
  });
  it('rejects an empty string', () => {
    expect(joinHouseholdSchema.safeParse({ inviteCode: '' }).success).toBe(false);
  });
  it('rejects a non-UUID format', () => {
    expect(joinHouseholdSchema.safeParse({ inviteCode: 'not-a-uuid' }).success).toBe(false);
  });
  it('trims whitespace', () => {
    const result = joinHouseholdSchema.safeParse({
      inviteCode: '   550e8400-e29b-41d4-a716-446655440000   ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inviteCode.startsWith(' ')).toBe(false);
  });
});
```

- [ ] **Step 10.2: Run**

Run: `npm test src/schemas/__tests__/household.schemas.test.ts`
Expected: 4 tests pass.

---

## Task 11: `onboarding.schemas.test.ts`

**Files:**
- Create: `FrontEnd/src/schemas/__tests__/onboarding.schemas.test.ts`

The onboarding schemas are the most complex: many step-specific factory functions, cross-step validations. Test the most important rules.

- [ ] **Step 11.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import {
  stepLivingArrangementSchema,
  creatorProfileSchema,
  createStepHouseholdStructureSchema,
  baseStepFinancialPreferencesSchema,
  createStepFinancialPreferencesSchema,
  createStepTaskPreferencesSchema,
} from '../onboarding.schemas';

describe('stepLivingArrangementSchema', () => {
  it('accepts a valid couple household', () => {
    expect(stepLivingArrangementSchema.safeParse({
      householdName: 'A & B', totalMembers: 2, livingArrangement: 'couple',
    }).success).toBe(true);
  });
  it('rejects householdName under 2 chars', () => {
    expect(stepLivingArrangementSchema.safeParse({
      householdName: 'A', totalMembers: 2, livingArrangement: 'couple',
    }).success).toBe(false);
  });
  it('requires livingArrangementOther when arrangement is "other"', () => {
    expect(stepLivingArrangementSchema.safeParse({
      householdName: 'X', totalMembers: 2, livingArrangement: 'other',
    }).success).toBe(false);
    expect(stepLivingArrangementSchema.safeParse({
      householdName: 'X', totalMembers: 2, livingArrangement: 'other', livingArrangementOther: 'co-op',
    }).success).toBe(true);
  });
});

describe('creatorProfileSchema', () => {
  it('accepts a valid creator profile', () => {
    expect(creatorProfileSchema.safeParse({
      nickname: 'Me', ageGroup: '26-35',
      participatesInFinances: true, participatesInTasks: true,
    }).success).toBe(true);
  });
  it('rejects empty nickname', () => {
    expect(creatorProfileSchema.safeParse({
      nickname: '', ageGroup: '26-35',
      participatesInFinances: true, participatesInTasks: true,
    }).success).toBe(false);
  });
});

describe('createStepHouseholdStructureSchema (couple, 2 members)', () => {
  const schema = createStepHouseholdStructureSchema('couple', 2);

  it('accepts exactly 1 partner entry', () => {
    expect(schema.safeParse({
      memberStructure: [{
        nickname: 'Partner', ageGroup: '26-35', relationship: 'partner',
        participatesInFinances: true, participatesInTasks: true, email: 'p@x.co',
      }],
    }).success).toBe(true);
  });

  it('rejects wrong member count', () => {
    expect(schema.safeParse({ memberStructure: [] }).success).toBe(false);
  });
});

describe('createStepFinancialPreferencesSchema', () => {
  it('alone arrangement: financeMode optional', () => {
    const schema = createStepFinancialPreferencesSchema('alone');
    expect(schema.safeParse({
      currency: 'BGN', trackedExpenseTypes: ['rent'],
    }).success).toBe(true);
  });

  it('couple arrangement: financeMode required', () => {
    const schema = createStepFinancialPreferencesSchema('couple');
    expect(schema.safeParse({
      currency: 'BGN', trackedExpenseTypes: ['rent'],
    }).success).toBe(false);
    expect(schema.safeParse({
      currency: 'BGN', trackedExpenseTypes: ['rent'], financeMode: 'shared',
    }).success).toBe(true);
  });
});

describe('createStepTaskPreferencesSchema', () => {
  it('alone arrangement: distribution method not required', () => {
    const schema = createStepTaskPreferencesSchema('alone');
    expect(schema.safeParse({ taskManagementEnabled: 'basic' }).success).toBe(true);
  });

  it('couple + tasks enabled: distribution method required', () => {
    const schema = createStepTaskPreferencesSchema('couple');
    expect(schema.safeParse({ taskManagementEnabled: 'basic' }).success).toBe(false);
    expect(schema.safeParse({
      taskManagementEnabled: 'basic', taskDistributionMethod: 'rotation',
    }).success).toBe(true);
  });
});
```

Notes:
- The exact enum values (`'couple'`, `'shared'`, `'rotation'`, etc.) come from the schema files. If a parse fails with "invalid enum", look up the allowed values in the source and adjust the test inputs.

- [ ] **Step 11.2: Run**

Run: `npm test src/schemas/__tests__/onboarding.schemas.test.ts`
Expected: ~12 tests pass.

---

## Task 12: `user.schemas.test.ts`

**Files:**
- Create: `FrontEnd/src/schemas/__tests__/user.schemas.test.ts`

- [ ] **Step 12.1: Write**

```ts
import { describe, it, expect } from 'vitest';
import {
  profileSchema,
  createProfileSchema,
  changePasswordSchema,
} from '../user.schemas';

describe('profileSchema', () => {
  it('accepts valid input without password', () => {
    expect(profileSchema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'a@b.co',
    }).success).toBe(true);
  });
  it('rejects short firstName', () => {
    expect(profileSchema.safeParse({
      firstName: 'A', lastName: 'A', email: 'a@b.co',
    }).success).toBe(false);
  });
});

describe('createProfileSchema (with original email)', () => {
  it('email unchanged → password not required', () => {
    const schema = createProfileSchema('alice@b.co');
    expect(schema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'alice@b.co',
    }).success).toBe(true);
  });
  it('email changed → password required', () => {
    const schema = createProfileSchema('alice@b.co');
    expect(schema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'new@b.co',
    }).success).toBe(false);
    expect(schema.safeParse({
      firstName: 'Alice', lastName: 'A', email: 'new@b.co', currentPassword: 'Pw',
    }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old', newPassword: 'Password123!', confirmNewPassword: 'Password123!',
    }).success).toBe(true);
  });
  it('rejects mismatched confirm', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old', newPassword: 'Password123!', confirmNewPassword: 'Different1!',
    }).success).toBe(false);
  });
  it('rejects weak new password', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old', newPassword: 'weak', confirmNewPassword: 'weak',
    }).success).toBe(false);
  });
});
```

- [ ] **Step 12.2: Run**

Run: `npm test src/schemas/__tests__/user.schemas.test.ts`
Expected: ~7 tests pass.

- [ ] **Step 12.3: User commit checkpoint**

Summary: "Frontend unit tests: hooks (useDebouncedValue, useBeforeUnload, useAuth, useTheme), utils (extractApiError, dashboardHelpers, cn), axios refresh interceptor, Zod schemas (auth, household, onboarding, user). ~70 cases."

---

## Batch 6 — Verification Checklist

From `FrontEnd/`:
- [ ] `npx tsc --noEmit -p tsconfig.json` → exits 0.
- [ ] `npm test` → entire frontend suite green (Batches 5+6, ~75 cases).
- [ ] `npm run test:coverage` → schemas, utils, hooks all ≥ 70%. The axios.ts file should also be ≥ 70% thanks to the focused interceptor test.

---

## Out of Scope for Batch 6

- Page integration tests (Batch 7).
- Form / dialog tests (Batch 7).
- E2E (Batch 8).
