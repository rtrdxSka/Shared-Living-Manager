# Testing — Batch 7: Frontend Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pre-requisite:** Batches 5 (foundation) and 6 (units) complete and green.

**Goal:** Add page-level and form-level integration tests covering all auth pages, route guards, dashboard pages, forms, and dialogs. Tests render the real components inside `renderWithProviders` and use MSW for the network layer.

**Architecture:** Each component gets its own test file in a co-located `__tests__/` folder. Tests focus on user-visible behaviour: do form fields render? does submit fire the right network call? does success close the sheet / show a message / refetch? does an error display? They do NOT assert on internal state.

**Tech Stack:** Same as Batches 5–6.

**User commit policy:** **"User commit checkpoint"** = stop, summarise, wait for commit.

**Strategy note:** This batch is the largest (~25-30 files, ~80-100 tests). The plan groups files into thematic sub-batches (route guards, auth pages, dashboard pages, forms, dialogs), each with its own commit checkpoint, so you can land subsections independently.

---

## File Structure

### Files to create — Sub-batch A: Route guards
- `FrontEnd/src/components/__tests__/ProtectedRoute.test.tsx`
- `FrontEnd/src/components/__tests__/GuestRoute.test.tsx`

### Files to create — Sub-batch B: Auth pages
- `FrontEnd/src/pages/__tests__/RegisterPage.test.tsx`
- `FrontEnd/src/pages/__tests__/ForgotPasswordPage.test.tsx`
- `FrontEnd/src/pages/__tests__/ResetPasswordPage.test.tsx`
- `FrontEnd/src/pages/__tests__/VerifyEmailPage.test.tsx`
- `FrontEnd/src/pages/__tests__/ProfilePage.test.tsx`

### Files to create — Sub-batch C: Forms
- `FrontEnd/src/components/dashboard/shared/__tests__/AddExpenseForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddTaskForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddGoalForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddShoppingItemForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddTransactionForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddRecurringTaskForm.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddRecurringItemForm.test.tsx`

### Files to create — Sub-batch D: Dialogs
- `FrontEnd/src/components/dashboard/shared/__tests__/SetRotationDialog.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/AddContributionDialog.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/JointAccountConfigDialog.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/ConfirmDeleteDialog.test.tsx`
- `FrontEnd/src/components/dashboard/shared/__tests__/DoneShoppingDialog.test.tsx`

### Files to create — Sub-batch E: Dashboard pages
- `FrontEnd/src/pages/dashboard/__tests__/OverviewPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/ExpensesPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/TasksPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/ShoppingListPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/GoalsPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/AccountPage.test.tsx`
- `FrontEnd/src/pages/dashboard/__tests__/InvitePage.test.tsx`

---

# Sub-batch A: Route guards

## Task 1: `ProtectedRoute.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/__tests__/ProtectedRoute.test.tsx`

- [ ] **Step 1.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '../../test/mocks/data/users';

const Dashboard = () => <div>Dashboard content</div>;
const Login = () => <div>Login page</div>;

const TestRoutes = () => (
  <Routes>
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<Dashboard />} />
    </Route>
    <Route path="/login" element={<Login />} />
  </Routes>
);

describe('<ProtectedRoute />', () => {
  it('redirects to /login when not authenticated', async () => {
    // Default refresh handler returns 401 → no session
    renderWithProviders(<TestRoutes />, { route: '/dashboard' });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('renders the child route when authenticated and verified', async () => {
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({
        status: 'success', data: { tokens: mockTokens },
      })),
      http.get('/api/auth/me', () => HttpResponse.json({
        status: 'success', data: { user: mockUsers.alice },
      })),
    );
    renderWithProviders(<TestRoutes />, { route: '/dashboard' });
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  });

  it('redirects to /profile when authenticated but unverified', async () => {
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({
        status: 'success', data: { tokens: mockTokens },
      })),
      http.get('/api/auth/me', () => HttpResponse.json({
        status: 'success', data: { user: mockUsers.daveUnverified },
      })),
    );

    const Profile = () => <div>Profile page</div>;
    const RoutesWithProfile = () => (
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    );
    renderWithProviders(<RoutesWithProfile />, { route: '/dashboard' });
    expect(await screen.findByText('Profile page')).toBeInTheDocument();
  });
});
```

Notes:
- Adjust the `import ProtectedRoute from '../ProtectedRoute'` if your file uses a named export.
- The exact "auth restore" flow involves the silent refresh on AuthProvider mount; the assertions wait via `findByText` which retries until the redirect resolves.

- [ ] **Step 1.2: Run**

Run: `npm test src/components/__tests__/ProtectedRoute.test.tsx`
Expected: 3 tests pass.

---

## Task 2: `GuestRoute.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/__tests__/GuestRoute.test.tsx`

- [ ] **Step 2.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { GuestRoute } from '../ProtectedRoute';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '../../test/mocks/data/users';

const Login = () => <div>Login form</div>;
const Dashboard = () => <div>Dashboard</div>;
const GetStarted = () => <div>Get Started</div>;

const TestRoutes = () => (
  <Routes>
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<Login />} />
    </Route>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/get-started" element={<GetStarted />} />
  </Routes>
);

describe('<GuestRoute />', () => {
  it('renders the child route when not authenticated', async () => {
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Login form')).toBeInTheDocument();
  });

  it('redirects authenticated users with a household to /dashboard', async () => {
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({
        status: 'success', data: { tokens: mockTokens },
      })),
      http.get('/api/auth/me', () => HttpResponse.json({
        status: 'success', data: { user: mockUsers.alice },
      })),
    );
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('redirects authenticated users with no household to /get-started', async () => {
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({
        status: 'success', data: { tokens: mockTokens },
      })),
      http.get('/api/auth/me', () => HttpResponse.json({
        status: 'success', data: { user: { ...mockUsers.alice, households: [] } },
      })),
    );
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Get Started')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run**

Run: `npm test src/components/__tests__/GuestRoute.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 2.3: User commit checkpoint**

Summary: "Route guard tests (~6 cases)."

---

# Sub-batch B: Auth pages

## Task 3: `RegisterPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/RegisterPage.test.tsx`

- [ ] **Step 3.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { RegisterPage } from '../RegisterPage';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

describe('<RegisterPage />', () => {
  it('renders all required fields', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText(/first name/i), 'Alice');
    await user.type(screen.getByLabelText(/last name/i), 'A');
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/match|mismatch|same/i)).toBeInTheDocument();
  });

  it('shows server error on duplicate email', async () => {
    server.use(http.post('/api/auth/register', () => HttpResponse.json(
      { status: 'error', message: 'Email already in use' },
      { status: 409 }
    )));
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText(/first name/i), 'Alice');
    await user.type(screen.getByLabelText(/last name/i), 'A');
    await user.type(screen.getByLabelText(/email/i), 'taken@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2: Run**

Run: `npm test src/pages/__tests__/RegisterPage.test.tsx`
Expected: 3 tests pass.

---

## Task 4: `ForgotPasswordPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/ForgotPasswordPage.test.tsx`

- [ ] **Step 4.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

describe('<ForgotPasswordPage />', () => {
  it('renders the email field and submit button', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset/i })).toBeInTheDocument();
  });

  it('shows the success state after submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send reset/i }));
    expect(await screen.findByText(/check your inbox|sent/i)).toBeInTheDocument();
  });

  it('rejects invalid email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset/i }));
    expect(await screen.findByText(/invalid|valid email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Run**

Run: `npm test src/pages/__tests__/ForgotPasswordPage.test.tsx`
Expected: 3 tests pass.

---

## Task 5: `ResetPasswordPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/ResetPasswordPage.test.tsx`

- [ ] **Step 5.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

describe('<ResetPasswordPage />', () => {
  it('shows invalid-token state when no token in query string', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password' });
    expect(screen.getByText(/invalid|expired/i)).toBeInTheDocument();
  });

  it('renders the form when token is present', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows success state after a valid reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });

    await user.type(screen.getByLabelText(/new password/i), 'BrandNewPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'BrandNewPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/password reset|success/i)).toBeInTheDocument();
  });

  it('shows error from server on bad token', async () => {
    server.use(http.post('/api/auth/reset-password', () => HttpResponse.json(
      { status: 'error', message: 'Token expired' }, { status: 404 }
    )));
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });

    await user.type(screen.getByLabelText(/new password/i), 'BrandNewPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'BrandNewPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run**

Run: `npm test src/pages/__tests__/ResetPasswordPage.test.tsx`
Expected: 4 tests pass.

---

## Task 6: `VerifyEmailPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/VerifyEmailPage.test.tsx`

- [ ] **Step 6.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { VerifyEmailPage } from '../VerifyEmailPage';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

describe('<VerifyEmailPage />', () => {
  it('shows success state when token is valid', async () => {
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=valid' });
    expect(await screen.findByText(/verified|verification/i)).toBeInTheDocument();
  });

  it('shows error state when token is missing', () => {
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email' });
    expect(screen.getByText(/no token|invalid|verification failed/i)).toBeInTheDocument();
  });

  it('shows error state when verification fails server-side', async () => {
    server.use(http.post('/api/auth/verify-email', () => HttpResponse.json(
      { status: 'error', message: 'Token expired' }, { status: 400 }
    )));
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=expired' });
    expect(await screen.findByText(/failed|expired/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run**

Run: `npm test src/pages/__tests__/VerifyEmailPage.test.tsx`
Expected: 3 tests pass.

---

## Task 7: `ProfilePage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/__tests__/ProfilePage.test.tsx`

- [ ] **Step 7.1: Write**

```tsx
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ProfilePage } from '../ProfilePage';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '../../test/mocks/data/users';

const renderAuthenticated = () => {
  server.use(
    http.post('/api/auth/refresh', () => HttpResponse.json({
      status: 'success', data: { tokens: mockTokens },
    })),
    http.get('/api/auth/me', () => HttpResponse.json({
      status: 'success', data: { user: mockUsers.alice },
    })),
  );
  return renderWithProviders(<ProfilePage />);
};

describe('<ProfilePage />', () => {
  it('renders profile fields', async () => {
    renderAuthenticated();
    await waitFor(() => expect(screen.getByLabelText(/first name/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('shows password fields and save button for password change', async () => {
    renderAuthenticated();
    await waitFor(() => expect(screen.getByLabelText(/current password/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('updates first name and shows success message', async () => {
    server.use(http.patch('/api/users/profile', async ({ request }) => {
      const body = await request.json() as any;
      return HttpResponse.json({ status: 'success', data: { user: { ...mockUsers.alice, ...body } } });
    }));

    renderAuthenticated();
    const user = userEvent.setup();
    const firstName = await screen.findByLabelText(/first name/i);
    await user.clear(firstName);
    await user.type(firstName, 'Alicia');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/updated successfully|profile updated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2: Run**

Run: `npm test src/pages/__tests__/ProfilePage.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 7.3: User commit checkpoint**

Summary: "Auth-page tests (Register, Forgot, Reset, Verify, Profile) — ~16 cases."

---

# Sub-batch C: Forms

The form tests are similar in shape: render, fill, submit, assert. Each is short.

## Task 8: `AddExpenseForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddExpenseForm.test.tsx`

- [ ] **Step 8.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddExpenseForm from '../AddExpenseForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../../test/mocks/data/households';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  household: mockHousehold as any,
  isAdmin: true,
  currentUserId: mockHousehold.members[0].userId,
};

describe('<AddExpenseForm />', () => {
  it('renders required form fields', () => {
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date|starts from/i)).toBeInTheDocument();
  });

  it('disables submit when description is empty', () => {
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    const submit = screen.getByRole('button', { name: /add|save|create/i });
    expect(submit).toBeDisabled();
  });

  it('submits a single expense and calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddExpenseForm {...baseProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/description/i), 'Coffee');
    await user.type(screen.getByLabelText(/amount/i), '5');
    // Category and date have UI defaults — skip for happy path

    await user.click(screen.getByRole('button', { name: /add|save|create/i }));

    // The form should close on success
    await screen.findByText(/coffee/i, {}, { timeout: 1500 }).catch(() => null);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

Notes:
- The exact submit button text varies (`Add`, `Save`, `Create expense`). The regex `/add|save|create/i` accommodates all.
- The `<AddExpenseForm>` import may be default or named — adjust accordingly.

- [ ] **Step 8.2: Run**

Expected: 3 tests pass.

---

## Task 9: `AddTaskForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddTaskForm.test.tsx`

- [ ] **Step 9.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddTaskForm from '../AddTaskForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: 'hh-couple-001',
};

describe('<AddTaskForm />', () => {
  it('renders title field and submit button', () => {
    renderWithProviders(<AddTaskForm {...baseProps} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('shows the assignee select only when distributionMethod=fixed and members provided', () => {
    const { rerender } = renderWithProviders(<AddTaskForm {...baseProps} />);
    expect(screen.queryByLabelText(/assign/i)).not.toBeInTheDocument();

    rerender(<AddTaskForm
      {...baseProps}
      distributionMethod="fixed"
      taskMembers={[{ _id: 'm1', nickname: 'Alice' }]}
    />);
    expect(screen.getByLabelText(/assign/i)).toBeInTheDocument();
  });

  it('submits a task and calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddTaskForm {...baseProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/title/i), 'Mop the floor');
    await user.click(screen.getByRole('button', { name: /add|save|create/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 9.2: Run**

Expected: 3 tests pass.

---

## Task 10: `AddGoalForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddGoalForm.test.tsx`

- [ ] **Step 10.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddGoalForm from '../AddGoalForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: 'hh-couple-001',
  currency: 'BGN',
};

describe('<AddGoalForm />', () => {
  it('renders name and target amount fields', () => {
    renderWithProviders(<AddGoalForm {...baseProps} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target amount/i)).toBeInTheDocument();
  });

  it('submits a goal and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddGoalForm {...baseProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/name/i), 'Holiday');
    await user.type(screen.getByLabelText(/target amount/i), '500');
    await user.click(screen.getByRole('button', { name: /add|save|create/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 10.2: Run**

Expected: 2 tests pass.

---

## Task 11: `AddShoppingItemForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddShoppingItemForm.test.tsx`

- [ ] **Step 11.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddShoppingItemForm from '../AddShoppingItemForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<AddShoppingItemForm />', () => {
  it('renders required fields', () => {
    renderWithProviders(<AddShoppingItemForm
      open={true} onOpenChange={vi.fn()} householdId="hh-couple-001"
    />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddShoppingItemForm
      open={true} onOpenChange={onOpenChange} householdId="hh-couple-001"
    />);
    await user.type(screen.getByLabelText(/^name$/i), 'Milk');
    await user.click(screen.getByRole('button', { name: /add|save/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 11.2: Run**

Expected: 2 tests pass.

---

## Task 12: `AddTransactionForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddTransactionForm.test.tsx`

- [ ] **Step 12.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddTransactionForm from '../AddTransactionForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<AddTransactionForm />', () => {
  it('renders amount and type controls', () => {
    renderWithProviders(<AddTransactionForm
      open={true} onOpenChange={vi.fn()} householdId="hh-couple-001" currency="BGN"
    />);
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deposit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });

  it('submits a deposit and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionForm
      open={true} onOpenChange={onOpenChange} householdId="hh-couple-001" currency="BGN"
    />);
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.click(screen.getByRole('button', { name: /add|save/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 12.2: Run**

Expected: 2 tests pass.

---

## Task 13: `AddRecurringTaskForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddRecurringTaskForm.test.tsx`

- [ ] **Step 13.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddRecurringTaskForm from '../AddRecurringTaskForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<AddRecurringTaskForm />', () => {
  it('renders title and interval', () => {
    renderWithProviders(<AddRecurringTaskForm
      open={true} onOpenChange={vi.fn()} householdId="hh-couple-001"
    />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repeats|interval/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddRecurringTaskForm
      open={true} onOpenChange={onOpenChange} householdId="hh-couple-001"
    />);
    await user.type(screen.getByLabelText(/title/i), 'Take out trash');
    await user.click(screen.getByRole('button', { name: /add|save|create/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 13.2: Run**

Expected: 2 tests pass.

---

## Task 14: `AddRecurringItemForm.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddRecurringItemForm.test.tsx`

- [ ] **Step 14.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddRecurringItemForm from '../AddRecurringItemForm';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<AddRecurringItemForm />', () => {
  it('renders name, category, cadence', () => {
    renderWithProviders(<AddRecurringItemForm
      open={true} onOpenChange={vi.fn()} householdId="hh-couple-001"
    />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cadence/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddRecurringItemForm
      open={true} onOpenChange={onOpenChange} householdId="hh-couple-001"
    />);
    await user.type(screen.getByLabelText(/name/i), 'Auto Milk');
    await user.click(screen.getByRole('button', { name: /add|save|create/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 14.2: User commit checkpoint**

Summary: "Form tests (AddExpense, AddTask, AddGoal, AddShoppingItem, AddTransaction, AddRecurringTask, AddRecurringItem) — ~16 cases."

---

# Sub-batch D: Dialogs

## Task 15: `SetRotationDialog.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/SetRotationDialog.test.tsx`

- [ ] **Step 15.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import SetRotationDialog from '../SetRotationDialog';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

const taskMembers = [
  { _id: 'm1', nickname: 'Alice' },
  { _id: 'm2', nickname: 'Bob' },
] as any;

describe('<SetRotationDialog />', () => {
  it('renders the starts-with select with members', () => {
    renderWithProviders(<SetRotationDialog
      open={true} onOpenChange={vi.fn()}
      taskMembers={taskMembers} onConfirm={vi.fn(async () => {})}
    />);
    expect(screen.getByLabelText(/starts with/i)).toBeInTheDocument();
  });

  it('calls onConfirm with the selected member id', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWithProviders(<SetRotationDialog
      open={true} onOpenChange={vi.fn()}
      taskMembers={taskMembers} onConfirm={onConfirm}
    />);
    await user.click(screen.getByRole('button', { name: /confirm|set rotation|start/i }));
    expect(onConfirm).toHaveBeenCalledWith('m1'); // first member is default
  });

  it('does not render when open=false', () => {
    renderWithProviders(<SetRotationDialog
      open={false} onOpenChange={vi.fn()}
      taskMembers={taskMembers} onConfirm={vi.fn(async () => {})}
    />);
    expect(screen.queryByLabelText(/starts with/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 15.2: Run**

Expected: 3 tests pass.

---

## Task 16: `AddContributionDialog.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/AddContributionDialog.test.tsx`

- [ ] **Step 16.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import AddContributionDialog from '../AddContributionDialog';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<AddContributionDialog />', () => {
  it('renders amount field', () => {
    renderWithProviders(<AddContributionDialog
      open={true} onOpenChange={vi.fn()}
      householdId="hh-couple-001" goalId="goal-001" goalName="Vacation" currency="BGN"
    />);
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddContributionDialog
      open={true} onOpenChange={onOpenChange}
      householdId="hh-couple-001" goalId="goal-001" goalName="Vacation" currency="BGN"
    />);
    await user.type(screen.getByLabelText(/amount/i), '50');
    await user.click(screen.getByRole('button', { name: /add|save/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 16.2: Run**

Expected: 2 tests pass.

---

## Task 17: `JointAccountConfigDialog.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/JointAccountConfigDialog.test.tsx`

- [ ] **Step 17.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import JointAccountConfigDialog from '../JointAccountConfigDialog';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<JointAccountConfigDialog />', () => {
  it('renders monthly target field and split mode toggle', () => {
    renderWithProviders(<JointAccountConfigDialog
      open={true} onOpenChange={vi.fn()}
      householdId="hh-couple-001" currency="BGN"
    />);
    expect(screen.getByLabelText(/monthly target/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /equal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument();
  });

  it('submits a target and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<JointAccountConfigDialog
      open={true} onOpenChange={onOpenChange}
      householdId="hh-couple-001" currency="BGN"
    />);
    await user.type(screen.getByLabelText(/monthly target/i), '1000');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 17.2: Run**

Expected: 2 tests pass.

---

## Task 18: `ConfirmDeleteDialog.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/ConfirmDeleteDialog.test.tsx`

- [ ] **Step 18.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

describe('<ConfirmDeleteDialog />', () => {
  it('renders title and description', () => {
    renderWithProviders(<ConfirmDeleteDialog
      open={true} onOpenChange={vi.fn()}
      title="Delete this item?" description="This cannot be undone."
      onConfirm={vi.fn(async () => {})}
    />);
    expect(screen.getByText('Delete this item?')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls onConfirm when delete clicked', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDeleteDialog
      open={true} onOpenChange={vi.fn()}
      title="X" onConfirm={onConfirm}
    />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDeleteDialog
      open={true} onOpenChange={onOpenChange}
      title="X" onConfirm={vi.fn(async () => {})}
    />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 18.2: Run**

Expected: 3 tests pass.

---

## Task 19: `DoneShoppingDialog.test.tsx`

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/__tests__/DoneShoppingDialog.test.tsx`

- [ ] **Step 19.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import DoneShoppingDialog from '../DoneShoppingDialog';
import { renderWithProviders } from '../../../../test/utils/renderWithProviders';

const boughtItems = [
  { id: 'i1', name: 'Milk', quantity: '2L', category: 'dairy' },
  { id: 'i2', name: 'Bread', quantity: '', category: 'bakery' },
] as any;

describe('<DoneShoppingDialog />', () => {
  it('lists the bought items grouped by category', () => {
    renderWithProviders(<DoneShoppingDialog
      open={true} onOpenChange={vi.fn()}
      boughtItems={boughtItems} dominantCategory={'groceries' as any}
      onConfirm={vi.fn()}
    />);
    expect(screen.getByText(/milk/i)).toBeInTheDocument();
    expect(screen.getByText(/bread/i)).toBeInTheDocument();
  });

  it('calls onConfirm and closes when user confirms', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DoneShoppingDialog
      open={true} onOpenChange={onOpenChange}
      boughtItems={boughtItems} dominantCategory={'groceries' as any}
      onConfirm={onConfirm}
    />);
    await user.click(screen.getByRole('button', { name: /done|confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 19.2: User commit checkpoint**

Summary: "Dialog tests (SetRotation, AddContribution, JointAccountConfig, ConfirmDelete, DoneShopping) — ~12 cases."

---

# Sub-batch E: Dashboard pages

These pages depend on `DashboardContext` which provides household, current member, modal state. Tests need to mock the context. Two approaches:

1. **Wrap the page in a `<DashboardProvider>` with mock initial state.** Cleanest but requires understanding the provider's API.
2. **Mock the `useDashboard` hook with `vi.mock`.** Quicker but couples tests to internal hook.

Below I use approach 2 — it's faster to write and the tests stay focused on user-facing behaviour.

## Task 20: `OverviewPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/OverviewPage.test.tsx`

- [ ] **Step 20.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import OverviewPage from '../OverviewPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      partnerMember: mockHousehold.members[1],
      isAdmin: true,
      financeMode: 'shared',
      splitMethod: 'income',
      currentMonth: '2026-05',
      setCurrentMonth: vi.fn(),
      setAddGoalOpen: vi.fn(),
      setAddTransactionOpen: vi.fn(),
      setAddTaskOpen: vi.fn(),
    }),
  };
});

describe('<OverviewPage />', () => {
  it('renders the page heading', () => {
    renderWithProviders(<OverviewPage />);
    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('renders the period filter buttons', () => {
    renderWithProviders(<OverviewPage />);
    expect(screen.getByRole('button', { name: /this month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all time/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 20.2: Run**

Expected: 2 tests pass.

---

## Task 21: `ExpensesPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/ExpensesPage.test.tsx`

- [ ] **Step 21.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ExpensesPage from '../ExpensesPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
      currentMonth: '2026-05',
      setCurrentMonth: vi.fn(),
      setAddExpenseOpen: vi.fn(),
      setEditingExpense: vi.fn(),
    }),
  };
});

describe('<ExpensesPage />', () => {
  it('renders the page heading and add expense button', async () => {
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByRole('heading', { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
  });

  it('eventually shows the expense rows from MSW handler', async () => {
    renderWithProviders(<ExpensesPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/groceries — week 1|april rent/i)
      ).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 21.2: Run**

Expected: 2 tests pass.

---

## Task 22: `TasksPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/TasksPage.test.tsx`

- [ ] **Step 22.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import TasksPage from '../TasksPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
      setAddTaskOpen: vi.fn(),
    }),
  };
});

describe('<TasksPage />', () => {
  it('renders the page heading and add task button', async () => {
    renderWithProviders(<TasksPage />);
    expect(await screen.findByRole('heading', { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('shows seeded task titles', async () => {
    renderWithProviders(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/wash the dishes/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 22.2: Run**

Expected: 2 tests pass.

---

## Task 23: `ShoppingListPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/ShoppingListPage.test.tsx`

- [ ] **Step 23.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ShoppingListPage from '../ShoppingListPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
    }),
  };
});

describe('<ShoppingListPage />', () => {
  it('renders the heading and add button', async () => {
    renderWithProviders(<ShoppingListPage />);
    expect(await screen.findByRole('heading', { name: /shopping/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('renders the active/history/recurring tabs', async () => {
    renderWithProviders(<ShoppingListPage />);
    expect(await screen.findByRole('tab', { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recurring/i })).toBeInTheDocument();
  });

  it('shows the seeded item', async () => {
    renderWithProviders(<ShoppingListPage />);
    await waitFor(() => expect(screen.getByText(/milk/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 23.2: Run**

Expected: 3 tests pass.

---

## Task 24: `GoalsPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/GoalsPage.test.tsx`

- [ ] **Step 24.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import GoalsPage from '../GoalsPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
      setAddGoalOpen: vi.fn(),
      setContributionTarget: vi.fn(),
    }),
  };
});

describe('<GoalsPage />', () => {
  it('renders the heading and add button', async () => {
    renderWithProviders(<GoalsPage />);
    expect(await screen.findByRole('heading', { name: /goals/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add goal/i })).toBeInTheDocument();
  });

  it('shows the seeded goal', async () => {
    renderWithProviders(<GoalsPage />);
    await waitFor(() => expect(screen.getByText(/vacation/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 24.2: Run**

Expected: 2 tests pass.

---

## Task 25: `AccountPage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/AccountPage.test.tsx`

- [ ] **Step 25.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AccountPage from '../AccountPage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
      accountMonth: '2026-05',
      setAccountMonth: vi.fn(),
      setAddTransactionOpen: vi.fn(),
    }),
  };
});

describe('<AccountPage />', () => {
  it('renders the heading and balance hero', async () => {
    renderWithProviders(<AccountPage />);
    expect(await screen.findByRole('heading', { name: /joint account/i })).toBeInTheDocument();
  });

  it('shows deposit and withdraw buttons', async () => {
    renderWithProviders(<AccountPage />);
    expect(await screen.findByRole('button', { name: /deposit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 25.2: Run**

Expected: 2 tests pass.

---

## Task 26: `InvitePage.test.tsx`

**Files:**
- Create: `FrontEnd/src/pages/dashboard/__tests__/InvitePage.test.tsx`

- [ ] **Step 26.1: Write**

```tsx
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import InvitePage from '../InvitePage';
import { renderWithProviders } from '../../../test/utils/renderWithProviders';
import { mockHousehold } from '../../../test/mocks/data/households';

vi.mock('../../../contexts/DashboardContext', async () => {
  const real = await vi.importActual<any>('../../../contexts/DashboardContext');
  return {
    ...real,
    useDashboard: () => ({
      household: { ...mockHousehold, totalMembers: 2 },
      currentUserId: mockHousehold.members[0].userId,
      myMember: mockHousehold.members[0],
      isAdmin: true,
    }),
  };
});

describe('<InvitePage />', () => {
  it('shows the invite code', () => {
    renderWithProviders(<InvitePage />);
    expect(screen.getByText('couple-invite-0001')).toBeInTheDocument();
  });

  it('"Copy" button writes invite code to clipboard', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<InvitePage />);
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('couple-invite-0001');
  });
});
```

- [ ] **Step 26.2: Run**

Expected: 2 tests pass.

- [ ] **Step 26.3: User commit checkpoint**

Summary: "Dashboard page tests (Overview, Expenses, Tasks, Shopping, Goals, Account, Invite) — ~15 cases."

---

## Batch 7 — Verification Checklist

From `FrontEnd/`:
- [ ] `npx tsc --noEmit -p tsconfig.json` → exits 0.
- [ ] `npm test` → entire frontend suite green (Batches 5+6+7, ~150 cases).
- [ ] `npm run test:coverage` → pages, forms, dialogs all in the report.

---

## Out of Scope for Batch 7

- E2E (Batch 8) — covered next.
- DashboardContext-internal logic (e.g., `setEditingExpense` behaviour) — those are state mutations the consumer doesn't need to test directly.
