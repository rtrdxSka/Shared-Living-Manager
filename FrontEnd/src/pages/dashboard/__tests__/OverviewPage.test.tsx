import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import OverviewPage from '@/pages/dashboard/OverviewPage';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

vi.mock('@/contexts/useDashboard', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/useDashboard')>(
    '@/contexts/useDashboard',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: 'user-alice-001',
      uiMode: 'couple',
      myMember: mockHousehold.members[0],
      partnerMember: mockHousehold.members[1],
      myNickname: 'Alice',
      partnerNickname: 'Bob',
      currency: 'EUR',
      myMemberId: 'mem-alice-001',
      isAdmin: true,
      myParticipatesInFinances: true,
      hasFinancialPartner: true,
      taskMembers: mockHousehold.members,
      financeMode: 'split',
      splitMethod: 'income_based',
      taskLevel: 'full',
      distribution: 'rotation',
      customMyPct: 50,
      setCustomMyPct: vi.fn(),
      incomeSplit: { myPct: 60, partnerPct: 40 },
      tasks: [],
      rotationStatus: null,
      tasksLoading: false,
      goals: [],
      goalsLoading: false,
      overdueCount: 0,
      currentMonth: '2026-05',
      setCurrentMonth: vi.fn(),
      addExpenseOpen: false,
      setAddExpenseOpen: vi.fn(),
      editingExpense: null,
      setEditingExpense: vi.fn(),
      addTaskOpen: false,
      setAddTaskOpen: vi.fn(),
      addRecurringTaskOpen: false,
      setAddRecurringTaskOpen: vi.fn(),
      rotationConfigOpen: false,
      setRotationConfigOpen: vi.fn(),
      addGoalOpen: false,
      setAddGoalOpen: vi.fn(),
      contributionTarget: null,
      setContributionTarget: vi.fn(),
      addTransactionOpen: false,
      setAddTransactionOpen: vi.fn(),
      openTransactionForm: vi.fn(),
      deleteExpense: vi.fn(),
      claimExpense: vi.fn(),
      requestResolution: vi.fn(),
      confirmResolution: vi.fn(),
      disputeResolution: vi.fn(),
      deactivateRecurringExpense: vi.fn(),
      toggleTaskComplete: vi.fn(),
      deleteTask: vi.fn(),
      assignTask: vi.fn(),
      setRotation: vi.fn(),
      deactivateRecurringTask: vi.fn(),
      updateGoal: vi.fn(),
      deleteGoal: vi.fn(),
      removeContribution: vi.fn(),
      deleteJointTransaction: vi.fn(),
      handleFinanceModeChange: vi.fn(),
      handleSplitMethodChange: vi.fn(),
      handleCustomPctCommit: vi.fn(),
    }),
  };
});

// Default insights payload with NO over-budget categories. Individual tests
// can override the handler with `server.use(...)` before rendering to flip
// the over-budget state on.
const buildInsightsPayload = (overBudgetCategories: string[] = []) => ({
  status: 'success',
  data: {
    month: '2026-05',
    budget: { groceries: 200 },
    budgetSource: 'live',
    spendByCategory: overBudgetCategories.length > 0
      ? { groceries: 350 }
      : { groceries: 50 },
    totalSpent: overBudgetCategories.length > 0 ? 350 : 50,
    totalBudgeted: 200,
    monthlyTrend: [],
    savingsRate: null,
    monthlyIncome: null,
    overBudgetCategories,
    byMember: [],
  },
});

// Stub all GET endpoints the page fires on render
beforeEach(() => {
  server.use(
    // Expenses list (infinite query — GET /households/:id/expenses)
    http.get('http://localhost:3000/api/households/:id/expenses', () =>
      HttpResponse.json({
        success: true,
        data: { items: [], nextCursor: null, total: 0 },
      }),
    ),
    // Joint account summary — only queried when financeMode === 'joint'; stubbed
    // for safety in case the enabled flag resolves to true
    http.get('http://localhost:3000/api/households/:id/joint-account', () =>
      HttpResponse.json({
        success: true,
        data: { summary: null },
      }),
    ),
    // Member income (used by IncomeManagementCard which renders for income_based split)
    http.get('http://localhost:3000/api/households/:id/members/income', () =>
      HttpResponse.json({
        success: true,
        data: { members: [] },
      }),
    ),
    // Budget insights — default to NO over-budget categories. Override in tests.
    http.get('http://localhost:3000/api/households/:id/budget/insights', () =>
      HttpResponse.json(buildInsightsPayload([])),
    ),
  );
});

describe('<OverviewPage />', () => {
  it('renders the page heading', () => {
    renderWithProviders(<OverviewPage />);
    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('renders the period/month controls', () => {
    renderWithProviders(<OverviewPage />);
    const thisMonthBtn = screen.queryByRole('button', { name: /this month/i });
    const allTimeBtn = screen.queryByRole('button', { name: /all time/i });
    expect(thisMonthBtn ?? allTimeBtn).toBeTruthy();
  });

  it('renders OverBudgetBanner when insights.overBudgetCategories.length > 0', async () => {
    server.use(
      http.get('http://localhost:3000/api/households/:id/budget/insights', () =>
        HttpResponse.json(buildInsightsPayload(['groceries'])),
      ),
    );
    renderWithProviders(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByTestId('over-budget-banner')).toBeInTheDocument();
    });
  });

  it('hides OverBudgetBanner when insights has no over-budget categories', async () => {
    renderWithProviders(<OverviewPage />);
    // Wait for the page to settle (insights query resolves).
    await screen.findByRole('heading', { name: /overview/i });
    // Give React Query a tick to populate; the banner must remain absent.
    await waitFor(() => {
      expect(screen.queryByTestId('over-budget-banner')).not.toBeInTheDocument();
    });
  });
});
