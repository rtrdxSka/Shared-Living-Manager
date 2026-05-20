# Testing Strategy — Shared Living Manager

## Context

Shared Living Manager is a couple/household budgeting + chores app (Master's project). Backend is Node + Express + TypeScript + Mongoose; frontend is React 19 + Vite + TanStack Query + react-hook-form + Zod. Both have **zero existing test infrastructure** today — no test runner, no test deps, no test files.

This spec defines a comprehensive automated test suite covering the features built so far, delivered in batches that can be implemented incrementally.

## Goals

- Prove that the existing features work as intended on both sides of the stack.
- Catch regressions when adding new features.
- Provide a thesis-defensible testing pyramid (unit / integration / E2E).
- Use realistic test data so tests double as living documentation.

## Decisions

| Area | Decision |
|------|----------|
| Test depth | Unit + integration + E2E |
| Backend runner | Vitest |
| Backend integration HTTP | supertest |
| Backend integration DB | Real MongoDB in Docker (shared with E2E, separate DB names) |
| Seed strategy | Drop + run rich seed script before each test FILE |
| Seed contents | Full demo dataset across multiple users, households, expenses, tasks, goals, shopping, transactions |
| Frontend runner | Vitest (jsdom) |
| Frontend component testing | React Testing Library + @testing-library/user-event |
| Frontend network mocking | MSW (Mock Service Worker) |
| Frontend test layout | `__tests__/` folders co-located with source |
| E2E runner | Playwright |
| E2E backend mode | Real Express app (`NODE_ENV=test`) against the shared test Mongo, database `slm-test-e2e` |
| Coverage goal | Comprehensive happy path + key error paths. ~70-80% on services and routes. |
| Schedulers / cron jobs | IN — fake timers, worker functions called directly |
| Auth refresh interceptor | IN — focused integration test |
| PWA / theme switcher | IN (smoke level only) |
| Email (Resend) | Mocked at module level; assert call args, not content |
| CI | None — local npm scripts only |

## Architecture

Three independent test surfaces, each runnable on its own:

1. **Backend Vitest** (`BackEnd/`): unit tests for services/utils, integration tests via supertest against a real Dockerised MongoDB (`slm-test-backend`), scheduler tests with fake timers.
2. **Frontend Vitest** (`FrontEnd/`): unit tests for hooks/utils/schemas, integration tests for pages/forms with RTL + MSW. Includes a focused test for the axios refresh-token queue.
3. **Playwright E2E** (`/e2e/`): drives the real app against the shared Mongo container on database `slm-test-e2e` (separate from backend integration DB so the two surfaces can run in parallel).

The same Docker container serves both backend integration and E2E runs.

## Backend Test Plan

### Folder layout
```
BackEnd/
  vitest.config.ts
  docker-compose.test.yml         # Mongo on host port 27018
  tests/
    setup.ts                      # connect to test Mongo, drop+seed before each file
    helpers/
      factories.ts                # adhoc createUser/Household/Expense for in-test data
      auth.ts                     # signTestJwt, authedAgent
      db.ts                       # dropDatabase, awaitMongoReady
    seed/
      seed.ts                     # programmatic seed via real Mongoose models
      fixtures.ts                 # FIXTURES.users.alice, FIXTURES.households.main, ...
      data/
        users.json                # ~6 users
        households.json           # ~3 households
        expenses.json             # ~30 expenses (mixed statuses / categories / dates)
        tasks.json                # ~10 tasks (some with rotation)
        goals.json                # ~3 goals with contributions
        shopping-items.json       # ~12 items
        joint-account-tx.json     # ~10 transactions
    mocks/
      email.mock.ts               # vi.mock for utils/email.ts
      logger.mock.ts              # silence pino in tests
    unit/
      services/                   # 11 service tests
      utils/                      # error, token, pagination, household.helpers
    integration/
      *.routes.test.ts            # 11 route groups
      middleware/                 # auth, emailVerified
      schedulers/                 # 4 cron workers
```

### Infrastructure

- **Database**: Docker MongoDB on host port 27018. Tests use database `slm-test-backend`. `tests/setup.ts` (registered via `vitest.config.ts` `setupFiles`) runs `beforeAll` to drop + reseed — vitest invokes setupFiles once per test file, giving us per-file isolation automatically. `afterAll` disconnects.
- **Seed script**: `tests/seed/seed.ts` reads JSON, inserts via real Mongoose models so validation/hooks (password hashing, etc.) run normally. Exports `seedDatabase()` and `FIXTURES`. Tests reference fixtures by name (`FIXTURES.users.alice.email`) instead of ad-hoc queries.
- **App import**: `BackEnd/src/index.ts:173` already exports `app`; supertest takes it directly. The HTTP listener never starts in tests.
- **JWT**: real `jsonwebtoken` with the same `JWT_SECRET` env var the app uses; `signTestJwt(userId)` helper.
- **Email**: `vi.mock('../../src/utils/email')` per integration test that triggers email sends. Assertions check the mock was called with the right user.
- **Schedulers**: each cron worker is exported as a function. Tests use `vi.useFakeTimers()` + `vi.setSystemTime(...)` and invoke the worker directly — no real cron scheduling.

### What gets tested

**Service unit tests** (one file per service, 11 total): "service + real DB, no HTTP". Run against the same Dockerised test Mongo as integration tests because Mongoose models have non-trivial validation/hooks (e.g., User pre-save password hashing) that mocks would have to re-implement.

**Route integration tests** (one file per route group, 11 total): full request/response loop via supertest — exercises routing, validators, middleware, controller, and error handler in one shot.

**Middleware tests**: minimal Express app per test that mounts only the middleware under test (auth, emailVerified).

**Scheduler tests** (4 total): call worker functions with seeded data and frozen time; assert that recurring rules spawn instances on the right boundaries and respect cron-lock idempotency.

### Coverage per feature (happy + key error paths)

- **Auth**: register, login, refresh, verify-email, forgot-password, reset-password, resend-verification. Errors: duplicate email (409), bad password (401), invalid token (400/401), unverified email path.
- **Household**: create, join via invite, get details, update settings, update member income, record settlement, regenerate invite. Errors: invalid invite, not-a-member, not-admin, full household.
- **Expense**: add, list (paginated/filtered), update, delete, claim, request-resolution, confirm-resolution, dispute-resolution. Errors: not-a-member, not-the-owner, invalid status transitions.
- **Task**: add, list, set rotation, assign, toggle complete, delete. Errors: not-admin for rotation, not-creator+not-admin for delete.
- **Goal**: full CRUD, contributions add/remove. Errors: insufficient balance, not-a-contributor.
- **Joint account / Shopping list / Recurring (×3)**: full CRUD + the most likely error per endpoint.
- **Schedulers**: each cron correctly spawns instances at the right time and is idempotent under cron-lock contention.

**Estimated count: ~110-130 backend test cases across ~30 files.**

## Frontend Test Plan

### Folder layout
```
FrontEnd/
  vitest.config.ts                # extends vite.config, jsdom env
  src/
    test/
      setup.ts                    # @testing-library/jest-dom + MSW server lifecycle
      utils/
        renderWithProviders.tsx   # QueryClient + MemoryRouter + AuthContext
        test-query-client.ts      # retry: false, gcTime: 0
      mocks/
        server.ts                 # setupServer with default handlers
        handlers/                 # one handler file per resource (auth, household, expense, task, ...)
        data/                     # canonical mock data shapes
    components/dashboard/shared/__tests__/AddExpenseForm.test.tsx
    pages/__tests__/LoginPage.test.tsx
    hooks/__tests__/useDebouncedValue.test.ts
    utils/__tests__/axios.test.ts
    ... etc
```

### Infrastructure

- **MSW**: one `setupServer()` shared across the suite; defaults in `handlers/` per resource. Individual tests override with `server.use(...)` for error/edge cases.
- **Render helper**: `renderWithProviders(ui, { authState, route, queryClient })` — used by every test. Avoids boilerplate, makes auth/routing conditions explicit.
- **No mocking of axios**: MSW intercepts at the fetch/XHR layer below axios, so the real axios instance and its interceptor run.
- **Refresh interceptor test** (`src/utils/__tests__/axios.test.ts`): 401 triggers refresh, parallel 401s queue and replay once, refresh failure logs out, 403 unverified email redirects to `/verify-email`.
- **PWA / theme**: smoke-only — one test for `useTheme` (toggles class on document) and one render test for the install prompt. PWA service worker logic is not unit-testable; covered (if at all) in E2E.

### What gets tested

**Unit tests**:
- Hooks: `useAuth` (provider boundary), `useTheme`, `useDebouncedValue`, `useBeforeUnload`, `useOnboarding`.
- Utils: `extractApiError`, `dashboardHelpers`, `cn`, plus the focused axios interceptor test.
- Zod schemas: `auth.schemas`, `household.schemas`, `onboarding.schemas`, `user.schemas` — accepted/rejected inputs.

**Integration tests** (RTL + MSW):
- **Auth pages**: LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage. Form validation, submit success, submit error, navigation.
- **Routing guards**: ProtectedRoute, GuestRoute.
- **Dashboard pages**: OverviewPage, ExpensesPage (filters + load-more), TasksPage, ShoppingListPage, GoalsPage, AccountPage, InvitePage. Initial load (loading/data/empty), filter interactions, pagination, mutation flows.
- **Forms**: AddExpenseForm, AddTaskForm, AddGoalForm, AddShoppingItemForm, AddTransactionForm, recurring variants. Validation, submit success (closes sheet, refetches), submit error.
- **Dialogs**: SetRotationDialog, AddContributionDialog, JointAccountConfigDialog, ConfirmDeleteDialog.

**Estimated count: ~80-100 frontend test cases across ~35-40 files.**

## E2E Test Plan (Playwright)

### Folder layout
```
e2e/
  playwright.config.ts
  global-setup.ts                 # ensure Mongo container up, start backend NODE_ENV=test, seed slm-test-e2e
  global-teardown.ts              # kill backend (container left running for next run)
  fixtures/
    test-data.ts
    db-helpers.ts                 # drop + reseed slm-test-e2e between spec files
  tests/
    auth.spec.ts                  # register → DB-token verify → login → logout
    onboarding.spec.ts            # create household + 2nd user joins via invite
    expenses.spec.ts              # add expense, edit, claim, settle
    tasks.spec.ts                 # add task, set rotation, complete
    shopping-list.spec.ts         # add item, mark bought, archive
    goals.spec.ts                 # create goal, contribute
    recurring-flows.spec.ts       # create recurring rule, trigger spawn
```

### Infrastructure

- **Shared Mongo**: same `BackEnd/docker-compose.test.yml` is reused. E2E runs against database `slm-test-e2e` (separate from backend integration's `slm-test-backend`) so both can run concurrently.
- **Backend boot**: `global-setup.ts` ensures the container is up, spawns the backend with `NODE_ENV=test`, `MONGODB_URI=mongodb://localhost:27018/slm-test-e2e`, `JWT_SECRET=test`, Resend env unset (email module no-ops in test). Runs the seed script.
- **DB reset**: before each spec file, `db-helpers.ts` drops `slm-test-e2e` and reseeds. Within a file, specs share the seed.
- **Email verification**: instead of a real mailbox, the test reads the verification token directly from the DB after register and visits `/verify-email?token=...`. Same for password reset.
- **Frontend**: Playwright's `webServer` runs `npm run dev` (or builds + serves preview) for the frontend.
- **Browsers**: Chromium only initially; Firefox/WebKit can be added later.

### Critical journeys

1. Register → email verify (DB token) → login → land on dashboard.
2. Create household → invite code shown → second user registers + joins via code.
3. Add expense → it appears for the partner → partner claims → owner confirms → expense settled.
4. Add task → set rotation → first member sees the task assigned → mark complete → next rotation shows correct assignee.
5. Add shopping item → mark bought → done-shopping flow archives it.
6. Add goal → contribute → balance updates.
7. Create a recurring expense rule → manually trigger the scheduler → instance spawned.

**Estimated count: ~7-10 specs, each with 1-3 scenarios.**

## File Touch Map

### New files
- Backend: `BackEnd/vitest.config.ts`, `BackEnd/docker-compose.test.yml`, `BackEnd/tests/**`
- Frontend: `FrontEnd/vitest.config.ts`, `FrontEnd/src/test/**`, `FrontEnd/src/**/__tests__/*.test.ts(x)`
- E2E: `e2e/**`

### Existing files possibly modified
- `BackEnd/package.json` — add test scripts and devDependencies.
- `FrontEnd/package.json` — add test scripts and devDependencies.
- `BackEnd/src/utils/email.ts` — confirm Resend client is mockable as-is. Verify before changing.
- `BackEnd/src/index.ts` — verify schedulers do not auto-start when only `app` is imported. Already separated via `startServer()` (line 128+), so should be fine; verify before changing.

## Batch Plan

| # | Batch | Deliverable |
|---|-------|------------|
| 1 | Backend foundation | Vitest config, `docker-compose.test.yml`, seed script + JSON fixture data, `tests/setup.ts` (drop + seed before each file), factories, smoke test (POST /auth/register passes against real Mongo). |
| 2 | Backend service unit tests | All 11 service files + 4 utils. |
| 3 | Backend route integration tests | All 11 route groups + middleware tests via supertest. |
| 4 | Backend scheduler tests | 4 scheduler tests with fake timers. |
| 5 | Frontend foundation | Vitest jsdom config, MSW server, renderWithProviders, smoke test on LoginPage. |
| 6 | Frontend unit tests | Hooks, utils (incl. axios refresh interceptor), Zod schemas. |
| 7 | Frontend integration tests | Auth pages, route guards, dashboard pages, forms, dialogs. |
| 8 | E2E setup + critical journeys | Playwright config, global setup, all 7 journeys. |

**Total estimate: ~200-240 tests across the three surfaces.**

## Verification

- `cd BackEnd && npm run test:db:up` → starts Dockerised test Mongo on port 27018.
- `cd BackEnd && npm test` → backend Vitest suite passes (unit + integration + scheduler), drops/reseeds `slm-test-backend` before each test file.
- `cd BackEnd && npm run test:coverage` → coverage report shows ≥70% on services and routes.
- `cd FrontEnd && npm test` → frontend Vitest suite passes (jsdom + MSW, no DB needed).
- `cd FrontEnd && npm run test:coverage` → coverage report.
- From repo root: `npm run test:e2e` boots backend with `NODE_ENV=test` against `slm-test-e2e`, builds + serves the frontend, runs all Playwright specs to green.
- `cd BackEnd && npm run test:db:down` → tears down test Mongo.

## Open Items / Known Risks

- **Resend email module**: confirm `vi.mock('../../src/utils/email')` works without code changes. If the Resend client is constructed at module top-level or lazily it's fine; verify before Batch 1.
- **Schedulers auto-starting on app import**: `startServer()` in `BackEnd/src/index.ts:128+` is the only boot path, so importing `app` for tests should not start them. Verify in Batch 1.
- **PWA in test env**: Vite PWA plugin may interfere with jsdom; we'll likely disable it via `vitest.config.ts` `mode: 'test'`.
- **Time-sensitive scheduler tests**: fake timers must be advanced carefully. We may end up calling worker functions directly rather than triggering them via cron expressions — that's the intended approach in this plan.
- **Docker dependency**: developers running tests need Docker. `npm run test:db:up` and `npm run test:db:down` scripts will be added; `npm test` will check the test Mongo is reachable and surface a clear error if not.
- **Seed file maintenance**: rich demo data is great for thesis demos but must be kept in sync with schema changes. Mitigation: seed inserts via real Mongoose models, so any schema change that breaks the seed surfaces immediately.
- **Port conflicts**: 27018 is the default for the test container. If the developer already has Mongo on 27018, `docker-compose.test.yml` will fail; document this in the README.
