import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import BudgetPage from '@/pages/dashboard/BudgetPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import type { UIMode, FinanceMode } from '@/types/onboarding.types';

// Mutable mock state so individual tests can flip uiMode + financeMode between
// 'couple/split', 'couple/joint', and 'solo' without re-mocking the module.
const mockState: { uiMode: UIMode; financeMode: FinanceMode } = {
  uiMode: 'couple',
  financeMode: 'split',
};

// Mock the DashboardContext hook — the existing pattern across dashboard
// page tests (see OverviewPage / AccountPage tests).
vi.mock('@/contexts/useDashboard', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/useDashboard')>(
    '@/contexts/useDashboard',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: mockHousehold,
      currentUserId: 'user-alice-001',
      uiMode: mockState.uiMode,
      myMember: mockHousehold.members[0],
      partnerMember: mockHousehold.members[1],
      myNickname: 'Alice',
      partnerNickname: 'Bob',
      currency: 'EUR',
      myMemberId: 'mem-alice-001',
      isAdmin: true,
      myParticipatesInFinances: true,
      hasFinancialPartner: true,
      financeMode: mockState.financeMode,
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

// Helper: install an MSW handler returning a budget-insights payload with
// the supplied `byMember` shape. Other fields are kept minimal but realistic.
function installInsightsHandler(byMember: unknown[]) {
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
            byMember,
          },
        }),
    ),
  );
}

beforeEach(() => {
  // Reset to couple-split mode by default; individual tests opt in to others.
  mockState.uiMode = 'couple';
  mockState.financeMode = 'split';
  installInsightsHandler([
    {
      memberId: 'mem-alice-001',
      nickname: 'Alice',
      totalShare: 30,
      shareByCategory: { groceries: 30 },
      totalPaid: 30,
      paidByCategory: { groceries: 30 },
    },
    {
      memberId: 'mem-bob-001',
      nickname: 'Bob',
      totalShare: 20,
      shareByCategory: { groceries: 20 },
      totalPaid: 20,
      paidByCategory: { groceries: 20 },
    },
  ]);
});

describe('BudgetPage smoke', () => {
  it('renders categories from insights payload', async () => {
    renderWithProviders(<BudgetPage />);
    expect(await screen.findByText('Categories')).toBeInTheDocument();
    // "Groceries" appears in both the CategoryBudgetRow and the SpendingBreakdownCard legend.
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
  });
});

describe('BudgetPage couple split mode', () => {
  it('renders Spending Comparison + paid sub-line and both share/paid category blocks', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'split';
    renderWithProviders(<BudgetPage />);

    // Wait for the page to finish loading.
    expect(await screen.findByText('Categories')).toBeInTheDocument();

    // The CoupleSpendComparisonCard renders in share mode (title is
    // "Spending Comparison") and surfaces the paid sub-line.
    expect(screen.getByText('Spending Comparison')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-row-me')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-row-partner')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-paid-subline')).toBeInTheDocument();

    // The groceries CategoryBudgetRow shows both share + paid sub-blocks.
    const splitBlock = screen.getByTestId('budget-split-groceries');
    expect(splitBlock).toBeInTheDocument();
    // Share values from fixture: Alice 30, Bob 20 — text is split across the
    // nickname text node and the MoneyAmount span, so assert via textContent.
    expect(splitBlock.textContent).toContain('Alice');
    expect(splitBlock.textContent).toContain('Bob');
    expect(splitBlock.textContent).toContain('30.00');
    expect(splitBlock.textContent).toContain('20.00');

    const paidBlock = screen.getByTestId('budget-paid-groceries');
    expect(paidBlock).toBeInTheDocument();
    // Paid block has the "paid:" prefix when accompanied by a share block.
    expect(paidBlock.textContent).toMatch(/paid:/i);
  });
});

describe('BudgetPage couple joint mode', () => {
  it('renders Payment Activity (no paid sub-line) and only paid category blocks', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'joint';
    // Joint-mode payload: totalShare + shareByCategory are undefined on both members.
    installInsightsHandler([
      {
        memberId: 'mem-alice-001',
        nickname: 'Alice',
        totalPaid: 40,
        paidByCategory: { groceries: 40 },
      },
      {
        memberId: 'mem-bob-001',
        nickname: 'Bob',
        totalPaid: 10,
        paidByCategory: { groceries: 10 },
      },
    ]);

    renderWithProviders(<BudgetPage />);

    expect(await screen.findByText('Categories')).toBeInTheDocument();

    // Comparison card renders as "Payment Activity" (paid mode).
    expect(screen.getByText('Payment Activity')).toBeInTheDocument();
    expect(screen.queryByText('Spending Comparison')).not.toBeInTheDocument();
    // No paid sub-line in joint mode — paid IS the headline metric.
    expect(screen.queryByTestId('comparison-paid-subline')).not.toBeInTheDocument();

    // No share sub-block in the CategoryBudgetRow…
    expect(screen.queryByTestId('budget-split-groceries')).not.toBeInTheDocument();
    // …but the paid sub-block IS there, and WITHOUT the "paid:" prefix (since
    // there's no accompanying share block to disambiguate against).
    const paidBlock = screen.getByTestId('budget-paid-groceries');
    expect(paidBlock).toBeInTheDocument();
    expect(paidBlock.textContent).not.toMatch(/paid:/i);
  });
});

describe('BudgetPage solo mode', () => {
  it('does not render the CoupleSpendComparisonCard or per-member splits in solo mode', async () => {
    mockState.uiMode = 'solo';
    mockState.financeMode = 'split';
    renderWithProviders(<BudgetPage />);

    expect(await screen.findByText('Categories')).toBeInTheDocument();

    // Comparison card must NOT be present.
    expect(screen.queryByText('Spending Comparison')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Activity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-row-me')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-row-partner')).not.toBeInTheDocument();

    // CategoryBudgetRow must NOT show either per-member sub-block.
    expect(screen.queryByTestId('budget-split-groceries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-paid-groceries')).not.toBeInTheDocument();
  });
});
