import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import BudgetPage from '@/pages/dashboard/BudgetPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

// Mock the DashboardContext hook — the existing pattern across dashboard
// page tests (see OverviewPage / AccountPage tests). BudgetPage only reads
// `household` from useDashboard, so we provide a minimal household object
// alongside the rest of the context shape to satisfy any future destructures.
vi.mock('@/contexts/DashboardContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/DashboardContext')>(
    '@/contexts/DashboardContext',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: 'user-alice-001',
      myMember: mockHousehold.members[0],
      partnerMember: mockHousehold.members[1],
      myNickname: 'Alice',
      partnerNickname: 'Bob',
      currency: 'EUR',
      myMemberId: 'mem-alice-001',
      isAdmin: true,
      myParticipatesInFinances: true,
      hasFinancialPartner: true,
      financeMode: 'split',
      splitMethod: 'equal',
      taskLevel: 'full',
      distribution: 'rotation',
      customMyPct: 50,
      setCustomMyPct: vi.fn(),
      incomeSplit: null,
      tasks: [],
      rotationStatus: null,
      tasksLoading: false,
      goals: [],
      goalsLoading: false,
      overdueCount: 0,
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

beforeEach(() => {
  server.use(
    http.get(
      `http://localhost:3000/api/households/${mockHousehold._id}/budget/insights`,
      () =>
        HttpResponse.json({
          status: 'success',
          data: {
            month: '2026-05',
            budget: { groceries: 200 },
            budgetSource: 'live',
            spendByCategory: { groceries: 50 },
            totalSpent: 50,
            totalBudgeted: 200,
            monthlyTrend: Array.from({ length: 6 }, (_, i) => ({
              monthString: `2026-0${i + 1}`,
              totalSpent: i * 10,
            })),
            savingsRate: null,
            monthlyIncome: null,
            overBudgetCategories: [],
          },
        }),
    ),
  );
});

describe('BudgetPage smoke', () => {
  it('renders categories from insights payload', async () => {
    renderWithProviders(<BudgetPage />);
    expect(await screen.findByText('Categories')).toBeInTheDocument();
    // "Groceries" appears in both the CategoryBudgetRow and the SpendingBreakdownCard legend.
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
  });
});
