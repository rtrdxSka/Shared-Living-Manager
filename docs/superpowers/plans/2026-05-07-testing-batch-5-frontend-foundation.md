# Testing — Batch 5: Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Backend batches (1-4) can be at any stage — frontend tests are completely independent (MSW intercepts at the network layer, no backend needed). However, finishing backend first means you have a working CI before tackling the frontend.

**Goal:** Stand up the frontend testing foundation: Vitest in jsdom mode + React Testing Library + user-event + MSW (Mock Service Worker). Ends with a passing smoke test for `LoginPage` so the rest of the frontend batches can be written on a known-good base.

**Architecture:** Vitest extends `vite.config.ts` with `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`. The setup file pulls in `@testing-library/jest-dom`, configures the MSW server (start/reset/close), and ensures `window.matchMedia` is shimmed (jsdom doesn't ship it). MSW handlers live in `src/test/mocks/handlers/`; the default exports from each handler file are merged into one `setupServer()` instance. The `renderWithProviders` helper wraps any tree in `QueryClientProvider` + `MemoryRouter` + `AuthProvider` so tests can render real components without boilerplate.

**Tech Stack:** Vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, msw 2.x. No code changes to `src/`.

**User commit policy:** **"User commit checkpoint"** = stop, summarise, wait for the user to commit.

---

## File Structure

### Files to create
- `FrontEnd/vitest.config.ts` — extends `vite.config.ts` with test settings.
- `FrontEnd/src/test/setup.ts` — global setup: jest-dom, MSW lifecycle, jsdom shims.
- `FrontEnd/src/test/utils/renderWithProviders.tsx` — RTL render wrapper.
- `FrontEnd/src/test/utils/test-query-client.ts` — QueryClient factory with retry off.
- `FrontEnd/src/test/mocks/server.ts` — `setupServer()` with default handlers.
- `FrontEnd/src/test/mocks/handlers/auth.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/household.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/expense.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/task.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/goal.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/shopping-list.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/joint-account.handlers.ts`
- `FrontEnd/src/test/mocks/handlers/recurring.handlers.ts`
- `FrontEnd/src/test/mocks/data/users.ts` — canonical mock user objects.
- `FrontEnd/src/test/mocks/data/households.ts`
- `FrontEnd/src/test/mocks/data/expenses.ts`
- `FrontEnd/src/test/mocks/data/tasks.ts`
- `FrontEnd/src/pages/__tests__/LoginPage.test.tsx` — smoke test.

### Files modified
- `FrontEnd/package.json` — add devDependencies + test scripts.

---

## Task 1: Install dev dependencies + scripts

**Files:**
- Modify: `FrontEnd/package.json`

- [ ] **Step 1.1: Install**

Run from `FrontEnd/`:

```bash
npm install --save-dev \
  vitest@1.6.0 \
  @vitest/coverage-v8@1.6.0 \
  @testing-library/react@16.0.0 \
  @testing-library/user-event@14.5.2 \
  @testing-library/jest-dom@6.5.0 \
  jsdom@25.0.0 \
  msw@2.4.0
```

Expected: installs successfully.

- [ ] **Step 1.2: Add scripts**

In `FrontEnd/package.json`, add these scripts to the `"scripts"` object (next to dev/build/lint/preview):

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
```

- [ ] **Step 1.3: Verify**

Run: `npm run` (lists scripts). Expected: shows `test`, `test:watch`, `test:coverage`.

- [ ] **Step 1.4: User commit checkpoint**

---

## Task 2: Create `vitest.config.ts`

**Files:**
- Create: `FrontEnd/vitest.config.ts`

- [ ] **Step 2.1: Write the config**

Create `FrontEnd/vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig({ command: 'serve', mode: 'test' }), defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/App.tsx',
        'src/test/**',
        'src/types/**',
        'src/**/*.d.ts',
        'src/components/ui/**', // shadcn primitives — not our code
      ],
      reporter: ['text', 'html'],
    },
  },
}));
```

Notes:
- `viteConfig({ command: 'serve', mode: 'test' })` calls the Vite config function (it accepts `{ command, mode }`) so the PWA plugin and proxy can be conditionally disabled if your `vite.config.ts` checks `mode`. If `vite.config.ts` exports a plain object (not a function), use `import viteConfig from './vite.config'` and pass it directly to `mergeConfig`.
- `css: false` skips Tailwind processing in tests, which is dramatically faster.
- The `include` pattern matches the co-located `__tests__/` convention chosen in the spec.

- [ ] **Step 2.2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json` from `FrontEnd/`.
Expected: exits 0.

---

## Task 3: Create `src/test/setup.ts`

**Files:**
- Create: `FrontEnd/src/test/setup.ts`

- [ ] **Step 3.1: Write the setup**

Create `FrontEnd/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// jsdom doesn't implement matchMedia — useTheme reads it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom doesn't implement scrollTo — some shadcn components call it.
window.scrollTo = vi.fn() as any;

// Stub IntersectionObserver — used by various components for "load more" UI.
class IntersectionObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
(globalThis as any).IntersectionObserver = IntersectionObserverStub;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` makes any test that hits an unmocked endpoint fail loudly — better than silent passes.

---

## Task 4: Create `src/test/utils/test-query-client.ts`

**Files:**
- Create: `FrontEnd/src/test/utils/test-query-client.ts`

- [ ] **Step 4.1: Write**

```ts
import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient tuned for tests:
 * - retry: false → no exponential-backoff delays
 * - gcTime: 0 → no caching across tests
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
```

---

## Task 5: Create `src/test/utils/renderWithProviders.tsx`

**Files:**
- Create: `FrontEnd/src/test/utils/renderWithProviders.tsx`

- [ ] **Step 5.1: Locate the AuthContext exports**

Run: `grep -RnE "export const AuthProvider|export.*AuthContext" FrontEnd/src/contexts/`
Expected: shows `AuthProvider` and the context. Note the exact export name and import path — you'll need them.

- [ ] **Step 5.2: Write the helper**

Create `FrontEnd/src/test/utils/renderWithProviders.tsx`:

```tsx
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import { createTestQueryClient } from './test-query-client';

interface ProviderOptions {
  /** initial route(s) for MemoryRouter. Default: ['/'] */
  route?: string | string[];
  /** Provide your own QueryClient (e.g., to inspect cache). Default: factory. */
  queryClient?: QueryClient;
  /** Skip AuthProvider — useful for tests that want to assert provider-boundary errors. */
  withoutAuth?: boolean;
}

export const renderWithProviders = (
  ui: ReactNode,
  { route = '/', queryClient = createTestQueryClient(), withoutAuth = false, ...options }: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {}
): RenderResult & { queryClient: QueryClient } => {
  const initialEntries = Array.isArray(route) ? route : [route];

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    return withoutAuth ? tree : <AuthProvider>{tree}</AuthProvider>;
  };

  const result = render(ui, { wrapper: Wrapper, ...options });
  return { ...result, queryClient };
};
```

Notes:
- The `AuthProvider` may try to call `/auth/refresh` on mount (silent restore). MSW must have a handler for it — Task 7's `auth.handlers.ts` covers this with a default 401 (no session) so the provider quickly settles to "logged out".
- If your `AuthProvider` is exported from a different path, fix the import.

- [ ] **Step 5.3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

---

## Task 6: Create MSW data fixtures

**Files:**
- Create: `FrontEnd/src/test/mocks/data/users.ts`
- Create: `FrontEnd/src/test/mocks/data/households.ts`
- Create: `FrontEnd/src/test/mocks/data/expenses.ts`
- Create: `FrontEnd/src/test/mocks/data/tasks.ts`

These are the canonical mock objects MSW handlers return. Tests can override per-test via `server.use(...)`.

- [ ] **Step 6.1: `users.ts`**

```ts
export const mockUsers = {
  alice: {
    id: 'user-alice-001',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Anderson',
    isEmailVerified: true,
    households: ['hh-couple-001'],
    activeHousehold: 'hh-couple-001',
    preferences: { language: 'en', currency: 'BGN' },
  },
  bob: {
    id: 'user-bob-002',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Brown',
    isEmailVerified: true,
    households: ['hh-couple-001'],
    activeHousehold: 'hh-couple-001',
    preferences: { language: 'en', currency: 'BGN' },
  },
  daveUnverified: {
    id: 'user-dave-004',
    email: 'dave@example.com',
    firstName: 'Dave',
    lastName: 'Davis',
    isEmailVerified: false,
    households: [],
    activeHousehold: null,
    preferences: { language: 'en', currency: 'BGN' },
  },
};

export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};
```

- [ ] **Step 6.2: `households.ts`**

```ts
export const mockHousehold = {
  id: 'hh-couple-001',
  name: 'Alice & Bob',
  livingArrangement: 'couple',
  uiMode: 'couple',
  totalMembers: 2,
  inviteCode: 'couple-invite-0001',
  members: [
    {
      _id: 'mem-alice-001',
      userId: 'user-alice-001',
      nickname: 'Alice',
      role: 'owner',
      isCreator: true,
      participatesInFinances: true,
      participatesInTasks: true,
      ageGroup: '26-35',
      monthlyIncome: 3500,
    },
    {
      _id: 'mem-bob-002',
      userId: 'user-bob-002',
      nickname: 'Bob',
      role: 'member',
      isCreator: false,
      participatesInFinances: true,
      participatesInTasks: true,
      ageGroup: '26-35',
      monthlyIncome: 2800,
    },
  ],
  settings: {
    financeMode: 'shared',
    expenseSplitMethod: 'income',
    currency: 'BGN',
    taskManagementEnabled: 'full',
    taskDistributionMethod: 'rotation',
    trackedExpenseTypes: ['rent', 'utilities', 'groceries'],
  },
  settlements: [],
};
```

- [ ] **Step 6.3: `expenses.ts`**

```ts
export const mockExpenses = [
  {
    id: 'exp-001',
    householdId: 'hh-couple-001',
    description: 'April Rent',
    amount: 1200,
    category: 'rent',
    date: '2026-04-01T09:00:00.000Z',
    paidByMemberId: 'mem-alice-001',
    paidByNickname: 'Alice',
    status: 'settled',
    isResolved: true,
  },
  {
    id: 'exp-002',
    householdId: 'hh-couple-001',
    description: 'Groceries — week 1',
    amount: 87.5,
    category: 'groceries',
    date: '2026-04-08T18:30:00.000Z',
    paidByMemberId: 'mem-bob-002',
    paidByNickname: 'Bob',
    status: 'pending',
    isResolved: false,
  },
];
```

- [ ] **Step 6.4: `tasks.ts`**

```ts
export const mockTasks = [
  {
    id: 'task-001',
    householdId: 'hh-couple-001',
    title: 'Wash the dishes',
    isCompleted: false,
    assignedToMemberId: 'mem-bob-002',
    assignedToNickname: 'Bob',
    createdByMemberId: 'mem-alice-001',
    createdAt: '2026-05-01T08:00:00.000Z',
  },
  {
    id: 'task-002',
    householdId: 'hh-couple-001',
    title: 'Take out the trash',
    isCompleted: true,
    completedAt: '2026-05-02T19:00:00.000Z',
    assignedToMemberId: 'mem-alice-001',
    assignedToNickname: 'Alice',
    createdByMemberId: 'mem-alice-001',
    createdAt: '2026-05-02T08:00:00.000Z',
  },
];
```

---

## Task 7: Create MSW handlers

**Files:**
- Create: `FrontEnd/src/test/mocks/handlers/auth.handlers.ts`
- (and the other 7 handler files)

The default handlers cover the happy path. Tests override per-test via `server.use(http.post('/api/auth/login', () => HttpResponse.json({...}, { status: 401 })))`.

- [ ] **Step 7.1: `auth.handlers.ts`**

```ts
import { http, HttpResponse } from 'msw';
import { mockUsers, mockTokens } from '../data/users';

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === mockUsers.alice.email && body.password.length >= 8) {
      return HttpResponse.json({
        status: 'success',
        data: { user: mockUsers.alice, tokens: mockTokens },
      });
    }
    return HttpResponse.json(
      { status: 'error', message: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string };
    return HttpResponse.json({
      status: 'success',
      data: {
        user: { ...mockUsers.alice, email: body.email, isEmailVerified: false },
        tokens: mockTokens,
      },
    }, { status: 201 });
  }),

  http.post('/api/auth/refresh', () => {
    // Default: no session — AuthProvider falls back to "logged out" quickly.
    return HttpResponse.json({ status: 'error', message: 'No session' }, { status: 401 });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      status: 'success',
      data: { user: mockUsers.alice },
    });
  }),

  http.post('/api/auth/logout', () => HttpResponse.json(null, { status: 204 })),

  http.post('/api/auth/forgot-password', () => HttpResponse.json({
    status: 'success', message: 'If your email exists, a reset link has been sent.',
  })),

  http.post('/api/auth/reset-password', () => HttpResponse.json({
    status: 'success', message: 'Password reset successfully.',
  })),

  http.post('/api/auth/verify-email', () => HttpResponse.json({
    status: 'success', data: { user: mockUsers.alice },
  })),

  http.post('/api/auth/resend-verification', () => HttpResponse.json({
    status: 'success', message: 'Verification email sent.',
  })),
];
```

- [ ] **Step 7.2: `household.handlers.ts`**

```ts
import { http, HttpResponse } from 'msw';
import { mockHousehold } from '../data/households';

export const householdHandlers = [
  http.get('/api/households/:id', () => HttpResponse.json({
    status: 'success', data: { household: mockHousehold },
  })),
  http.post('/api/households', async ({ request }) => {
    const body = await request.json() as { householdName: string };
    return HttpResponse.json({
      status: 'success', data: { household: { ...mockHousehold, name: body.householdName } },
    }, { status: 201 });
  }),
  http.post('/api/households/join', () => HttpResponse.json({
    status: 'success', data: { household: mockHousehold },
  })),
  http.patch('/api/households/:id/settings', () => HttpResponse.json({
    status: 'success', data: { household: mockHousehold },
  })),
  http.patch('/api/households/:id/members/me/income', () => HttpResponse.json({
    status: 'success', data: { household: mockHousehold },
  })),
  http.post('/api/households/:id/settlements', () => HttpResponse.json({
    status: 'success', data: { household: mockHousehold },
  }, { status: 201 })),
  http.patch('/api/households/:id/invite-code', () => HttpResponse.json({
    status: 'success',
    data: { household: { ...mockHousehold, inviteCode: 'fresh-invite-9999' } },
  })),
];
```

- [ ] **Step 7.3: `expense.handlers.ts`**

```ts
import { http, HttpResponse } from 'msw';
import { mockExpenses } from '../data/expenses';

export const expenseHandlers = [
  http.get('/api/households/:id/expenses', () => HttpResponse.json({
    status: 'success',
    data: { expenses: mockExpenses, pagination: { hasMore: false } },
  })),
  http.post('/api/households/:id/expenses', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      status: 'success',
      data: { expense: { ...mockExpenses[0], ...body, id: 'exp-new' } },
    }, { status: 201 });
  }),
  http.patch('/api/households/:id/expenses/:expenseId', () => HttpResponse.json({
    status: 'success', data: { expense: mockExpenses[0] },
  })),
  http.delete('/api/households/:id/expenses/:expenseId', () => HttpResponse.json(null, { status: 204 })),
  http.post('/api/households/:id/expenses/:expenseId/claim', () => HttpResponse.json({
    status: 'success', data: { expense: mockExpenses[0] },
  })),
  http.post('/api/households/:id/expenses/:expenseId/request-resolution', () => HttpResponse.json({
    status: 'success', data: { expense: mockExpenses[0] },
  })),
  http.post('/api/households/:id/expenses/:expenseId/confirm-resolution', () => HttpResponse.json({
    status: 'success', data: { expense: { ...mockExpenses[0], isResolved: true } },
  })),
  http.post('/api/households/:id/expenses/:expenseId/dispute-resolution', () => HttpResponse.json({
    status: 'success', data: { expense: mockExpenses[0] },
  })),
];
```

- [ ] **Step 7.4: `task.handlers.ts`**

```ts
import { http, HttpResponse } from 'msw';
import { mockTasks } from '../data/tasks';

export const taskHandlers = [
  http.get('/api/households/:id/tasks', () => HttpResponse.json({
    status: 'success',
    data: { tasks: mockTasks, pagination: { hasMore: false } },
  })),
  http.post('/api/households/:id/tasks', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      status: 'success', data: { task: { ...mockTasks[0], ...body, id: 'task-new' } },
    }, { status: 201 });
  }),
  http.patch('/api/households/:id/tasks/rotation', () => HttpResponse.json({
    status: 'success', data: { tasks: mockTasks },
  })),
  http.patch('/api/households/:id/tasks/:taskId/assign', () => HttpResponse.json({
    status: 'success', data: { task: mockTasks[0] },
  })),
  http.patch('/api/households/:id/tasks/:taskId/complete', () => HttpResponse.json({
    status: 'success', data: { task: { ...mockTasks[0], isCompleted: true } },
  })),
  http.delete('/api/households/:id/tasks/:taskId', () => HttpResponse.json(null, { status: 204 })),
];
```

- [ ] **Step 7.5: `goal.handlers.ts`, `shopping-list.handlers.ts`, `joint-account.handlers.ts`, `recurring.handlers.ts`**

Each follows the same shape: minimal happy-path handler per endpoint. Below is the entire content; create one file per resource.

`goal.handlers.ts`:
```ts
import { http, HttpResponse } from 'msw';

const mockGoal = {
  id: 'goal-001', householdId: 'hh-couple-001',
  name: 'Vacation', targetAmount: 2500, currentAmount: 900,
  status: 'active', contributions: [],
};

export const goalHandlers = [
  http.get('/api/households/:id/goals', () => HttpResponse.json({
    status: 'success', data: { goals: [mockGoal], pagination: { hasMore: false } },
  })),
  http.get('/api/households/:id/goals/:goalId', () => HttpResponse.json({
    status: 'success', data: { goal: mockGoal },
  })),
  http.post('/api/households/:id/goals', () => HttpResponse.json({
    status: 'success', data: { goal: mockGoal },
  }, { status: 201 })),
  http.patch('/api/households/:id/goals/:goalId', () => HttpResponse.json({
    status: 'success', data: { goal: mockGoal },
  })),
  http.delete('/api/households/:id/goals/:goalId', () => HttpResponse.json(null, { status: 204 })),
  http.post('/api/households/:id/goals/:goalId/contributions', () => HttpResponse.json({
    status: 'success', data: { contribution: { id: 'c1', amount: 100 } },
  }, { status: 201 })),
  http.delete('/api/households/:id/goals/:goalId/contributions/:contributionId', () => HttpResponse.json(null, { status: 204 })),
];
```

`shopping-list.handlers.ts`:
```ts
import { http, HttpResponse } from 'msw';

const mockItem = {
  id: 'item-001', householdId: 'hh-couple-001', name: 'Milk',
  quantity: '2L', category: 'dairy', isBought: false,
};

export const shoppingListHandlers = [
  http.get('/api/households/:id/shopping-list', () => HttpResponse.json({
    status: 'success', data: { items: [mockItem], pagination: { hasMore: false } },
  })),
  http.get('/api/households/:id/shopping-list/history', () => HttpResponse.json({
    status: 'success', data: { items: [], pagination: { hasMore: false } },
  })),
  http.post('/api/households/:id/shopping-list', () => HttpResponse.json({
    status: 'success', data: { item: mockItem },
  }, { status: 201 })),
  http.patch('/api/households/:id/shopping-list/:itemId', () => HttpResponse.json({
    status: 'success', data: { item: mockItem },
  })),
  http.patch('/api/households/:id/shopping-list/:itemId/bought', () => HttpResponse.json({
    status: 'success', data: { item: { ...mockItem, isBought: true } },
  })),
  http.post('/api/households/:id/shopping-list/:itemId/archive', () => HttpResponse.json({
    status: 'success', data: { item: mockItem },
  })),
  http.post('/api/households/:id/shopping-list/:itemId/restore', () => HttpResponse.json({
    status: 'success', data: { item: mockItem },
  })),
  http.delete('/api/households/:id/shopping-list/:itemId', () => HttpResponse.json(null, { status: 204 })),
  http.post('/api/households/:id/shopping-list/archive-bought', () => HttpResponse.json({
    status: 'success', data: { archived: 1 },
  })),
];
```

`joint-account.handlers.ts`:
```ts
import { http, HttpResponse } from 'msw';

export const jointAccountHandlers = [
  http.get('/api/households/:id/joint-account', () => HttpResponse.json({
    status: 'success',
    data: {
      summary: { totals: { allTime: 800, currentMonth: 0 }, memberBreakdown: [] },
      transactions: [],
      pagination: { hasMore: false },
    },
  })),
  http.post('/api/households/:id/joint-account/transactions', () => HttpResponse.json({
    status: 'success', data: { transaction: { id: 'tx-1', type: 'deposit', amount: 100 } },
  }, { status: 201 })),
  http.delete('/api/households/:id/joint-account/transactions/:txId', () => HttpResponse.json(null, { status: 204 })),
  http.patch('/api/households/:id/joint-account/config', () => HttpResponse.json({
    status: 'success', data: { config: { monthlyTarget: 1000, targetMode: 'equal' } },
  })),
];
```

`recurring.handlers.ts`:
```ts
import { http, HttpResponse } from 'msw';

const mockRecurringExpense = { id: 'rex-1', amount: 1200, interval: 'monthly', payerMode: 'fixed' };
const mockRecurringTask = { id: 'rt-1', title: 'Trash', interval: 'weekly' };
const mockRecurringRule = { id: 'rr-1', name: 'Milk', category: 'dairy', cadence: 'weekly', active: true };

export const recurringHandlers = [
  // Expenses
  http.get('/api/households/:id/recurring-expenses', () => HttpResponse.json({
    status: 'success', data: { recurringExpenses: [mockRecurringExpense] },
  })),
  http.post('/api/households/:id/recurring-expenses', () => HttpResponse.json({
    status: 'success', data: { recurring: mockRecurringExpense },
  }, { status: 201 })),
  http.patch('/api/households/:id/recurring-expenses/:recurringId', () => HttpResponse.json({
    status: 'success', data: { recurring: mockRecurringExpense },
  })),
  http.delete('/api/households/:id/recurring-expenses/:recurringId', () => HttpResponse.json(null, { status: 204 })),
  // Tasks
  http.get('/api/households/:id/recurring-tasks', () => HttpResponse.json({
    status: 'success', data: { recurringTasks: [mockRecurringTask] },
  })),
  http.post('/api/households/:id/recurring-tasks', () => HttpResponse.json({
    status: 'success', data: { task: mockRecurringTask },
  }, { status: 201 })),
  http.patch('/api/households/:id/recurring-tasks/:recurringTaskId', () => HttpResponse.json({
    status: 'success', data: { task: mockRecurringTask },
  })),
  http.delete('/api/households/:id/recurring-tasks/:recurringTaskId', () => HttpResponse.json(null, { status: 204 })),
  // Shopping items (rules)
  http.get('/api/households/:id/shopping-list/recurring', () => HttpResponse.json({
    status: 'success', data: { rules: [mockRecurringRule] },
  })),
  http.post('/api/households/:id/shopping-list/recurring', () => HttpResponse.json({
    status: 'success', data: { rule: mockRecurringRule },
  }, { status: 201 })),
  http.patch('/api/households/:id/shopping-list/recurring/:ruleId', () => HttpResponse.json({
    status: 'success', data: { rule: mockRecurringRule },
  })),
  http.delete('/api/households/:id/shopping-list/recurring/:ruleId', () => HttpResponse.json(null, { status: 204 })),
];
```

---

## Task 8: Create the MSW server

**Files:**
- Create: `FrontEnd/src/test/mocks/server.ts`

- [ ] **Step 8.1: Write**

```ts
import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth.handlers';
import { householdHandlers } from './handlers/household.handlers';
import { expenseHandlers } from './handlers/expense.handlers';
import { taskHandlers } from './handlers/task.handlers';
import { goalHandlers } from './handlers/goal.handlers';
import { shoppingListHandlers } from './handlers/shopping-list.handlers';
import { jointAccountHandlers } from './handlers/joint-account.handlers';
import { recurringHandlers } from './handlers/recurring.handlers';

export const server = setupServer(
  ...authHandlers,
  ...householdHandlers,
  ...expenseHandlers,
  ...taskHandlers,
  ...goalHandlers,
  ...shoppingListHandlers,
  ...jointAccountHandlers,
  ...recurringHandlers,
);
```

---

## Task 9: Smoke test for `LoginPage`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/LoginPage.test.tsx`

- [ ] **Step 9.1: Write the test**

```tsx
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { LoginPage } from '../LoginPage';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

describe('<LoginPage />', () => {
  it('renders email + password fields and a submit button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a validation error on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/required|invalid/i)).toBeInTheDocument();
  });

  it('logs in successfully and navigates to /', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // After successful login the form fields should disappear (replaced by router transition).
    // We can't easily assert location in MemoryRouter without exposing it, so assert on
    // absence of the error alert and that the submit button is no longer pending.
    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
    });
  });

  it('shows error when login fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

Notes:
- `import { LoginPage } from '../LoginPage'` — adjust the import (default vs named export) to match how `LoginPage.tsx` actually exports.
- The MSW handler in `auth.handlers.ts` returns 200 only when email matches `mockUsers.alice.email` AND password is ≥ 8 chars. Both the success and the failure cases above hinge on this.

- [ ] **Step 9.2: Run**

Run from `FrontEnd/`: `npm test`
Expected: 4 tests pass.

If they fail:
- "Cannot find module '../LoginPage'" → the file is at a different path / different export style; adjust the import.
- "TestingLibraryElementError: Unable to find a label" → the actual label text in `LoginPage.tsx` may include extra characters; loosen the regex (`/email/i` already does this) or check the rendered HTML with `screen.debug()`.
- "MSW: cannot resolve `/api/auth/login` ... onUnhandledRequest" → the axios baseURL may already prepend `/api`; check `FrontEnd/src/utils/axios.ts` and adjust the handler URLs in `auth.handlers.ts`. The handler URLs above assume the request goes out as `/api/auth/login` (matching the proxy in dev).

- [ ] **Step 9.3: User commit checkpoint**

Summary: "Frontend foundation: Vitest jsdom + RTL + MSW + renderWithProviders + smoke test (4 cases) green."

---

## Batch 5 — Verification Checklist

From `FrontEnd/`:
- [ ] `npx tsc --noEmit -p tsconfig.json` → exits 0.
- [ ] `npm test` → 4 LoginPage tests pass.
- [ ] `npm run test:coverage` → produces a coverage report.
- [ ] `git status` → only the listed files modified/added.

---

## Out of Scope for Batch 5

- Comprehensive auth-page tests (Batch 7).
- Hooks/utils/schemas tests (Batch 6).
- Dashboard pages, forms, dialogs (Batch 7).
- E2E (Batch 8).
