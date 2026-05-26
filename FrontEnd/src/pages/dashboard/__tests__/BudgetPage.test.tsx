import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import BudgetPage from '@/pages/dashboard/BudgetPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import type { UIMode, FinanceMode, ExpenseSplitMethod } from '@/types/onboarding.types';

// Mutable mock state so individual tests can flip uiMode + financeMode +
// splitMethod between 'couple/split', 'couple/joint', 'roommates', and 'solo'
// without re-mocking the module.
const mockState: {
  uiMode: UIMode;
  financeMode: FinanceMode;
  splitMethod: ExpenseSplitMethod;
} = {
  uiMode: 'couple',
  financeMode: 'split',
  splitMethod: 'equal',
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
      splitMethod: mockState.splitMethod,
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
      claimPayback: vi.fn(),
      confirmPayback: vi.fn(),
      disputePayback: vi.fn(),
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
  mockState.splitMethod = 'equal';
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

    // Couples do NOT get the lighter roommate "your share" subline.
    expect(screen.queryByTestId('budget-myshare-groceries')).not.toBeInTheDocument();
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

    // Joint mode is pooled — there is no per-person scope to toggle to.
    expect(screen.queryByTestId('budget-scope-toggle')).not.toBeInTheDocument();
    // Third card is the budget status (household budget vs spend), not a
    // savings rate. Default payload: budgeted 200, spent 50 → 150 left, 25% used.
    expect(screen.queryByTestId('budget-savings-rate')).not.toBeInTheDocument();
    const status = screen.getByTestId('budget-status');
    expect(status.textContent).toMatch(/150\.00/);
    expect(status.textContent).toMatch(/left/i);
    expect(status.textContent).toMatch(/25%/);
  });
});

describe('BudgetPage solo mode', () => {
  it('does not render the CoupleSpendComparisonCard, per-member splits, or scope toggle in solo mode', async () => {
    mockState.uiMode = 'solo';
    mockState.financeMode = 'split';
    // A solo household has a single member, so the per-member breakdown toggle
    // must not appear (it requires 2+ members).
    installInsightsHandler([
      {
        memberId: 'mem-alice-001',
        nickname: 'Alice',
        totalShare: 50,
        shareByCategory: { groceries: 50 },
        totalPaid: 50,
        paidByCategory: { groceries: 50 },
      },
    ]);
    renderWithProviders(<BudgetPage />);

    expect(await screen.findByText('Categories')).toBeInTheDocument();

    // Single-member household: no per-member breakdown toggle.
    expect(screen.queryByTestId('breakdown-mode-toggle')).not.toBeInTheDocument();

    // Comparison card must NOT be present.
    expect(screen.queryByText('Spending Comparison')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Activity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-row-me')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-row-partner')).not.toBeInTheDocument();

    // CategoryBudgetRow must NOT show any per-member sub-block.
    expect(screen.queryByTestId('budget-split-groceries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-paid-groceries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-myshare-groceries')).not.toBeInTheDocument();

    // The YOU/HOUSEHOLD toggle is couple-split only.
    expect(screen.queryByTestId('budget-scope-toggle')).not.toBeInTheDocument();

    // Solo no longer sets income on the budget page (income lives on Account);
    // the third summary card is the budget status, not an income-based savings rate.
    expect(screen.queryByText(/your income/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-savings-rate')).not.toBeInTheDocument();
    expect(screen.getByTestId('budget-status')).toBeInTheDocument();
  });
});

describe('BudgetPage caps-always-household (couple split)', () => {
  function installScopedHandler(): string[] {
    const requestedScopes: string[] = [];
    server.use(
      http.get(
        `http://localhost:3000/api/households/${mockHousehold._id}/budget/insights`,
        ({ request }) => {
          const url = new URL(request.url);
          requestedScopes.push(url.searchParams.get('scope') ?? 'none');
          return HttpResponse.json({
            status: 'success',
            data: {
              month: '2026-05',
              budget: { rent: 1500 },
              budgetSource: 'live',
              spendByCategory: { rent: 900 },
              totalSpent: 900,
              totalBudgeted: 1500,
              monthlyTrend: Array.from({ length: 6 }, (_, i) => ({
                monthString: `2026-0${i + 1}`,
                totalSpent: 0,
              })),
              savingsRate: 0.5,
              monthlyIncome: 3000,
              overBudgetCategories: [],
              byMember: [
                {
                  memberId: 'mem-alice-001',
                  nickname: 'Alice',
                  totalShare: 500,
                  shareByCategory: { rent: 500 },
                  totalPaid: 900,
                  paidByCategory: { rent: 900 },
                },
                {
                  memberId: 'mem-bob-001',
                  nickname: 'Bob',
                  totalShare: 400,
                  shareByCategory: { rent: 400 },
                  totalPaid: 0,
                  paidByCategory: {},
                },
              ],
              requestedScope: 'household',
              effectiveScope: 'household',
            },
          });
        },
      ),
    );
    return requestedScopes;
  }

  it('always requests household scope and never shows the personal-share disclaimer', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'split';
    const requestedScopes = installScopedHandler();

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    expect(requestedScopes.length).toBeGreaterThan(0);
    expect(requestedScopes.every((s) => s === 'household')).toBe(true);
    expect(
      screen.queryByText(/your share of spending shown/i),
    ).not.toBeInTheDocument();
  });

  it('has no scope toggle; the summary is the household budget picture (spent / budgeted / status), no income-based savings', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'split';
    installScopedHandler();

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    // The YOU/HOUSEHOLD toggle is gone.
    expect(screen.queryByTestId('budget-scope-toggle')).not.toBeInTheDocument();

    // All three summary cards are the same budget scope (spend vs cap vs
    // remaining) — internally consistent, no income anywhere.
    expect(screen.getByTestId('budget-total-spent').textContent).toContain('900.00');
    expect(screen.getByTestId('budget-total-budgeted').textContent).toContain('1500.00');

    // Third card is the budget status, not an income-based savings rate.
    // budgeted 1500, spent 900 → 600 left, 60% used.
    expect(screen.queryByTestId('budget-savings-rate')).not.toBeInTheDocument();
    expect(screen.queryByText(/savings rate/i)).not.toBeInTheDocument();
    const status = screen.getByTestId('budget-status');
    expect(status.textContent).toMatch(/600\.00/);
    expect(status.textContent).toMatch(/left/i);
    expect(status.textContent).toMatch(/60%/);

    // The income-based per-member savings line is gone from the comparison card.
    expect(screen.queryByTestId('comparison-savings-me')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-savings-partner')).not.toBeInTheDocument();
  });
});

describe('BudgetPage budget status card', () => {
  it('shows "over" with the overage and >100% used when household spend exceeds the cap', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'split';
    server.use(
      http.get(
        `http://localhost:3000/api/households/${mockHousehold._id}/budget/insights`,
        () =>
          HttpResponse.json({
            status: 'success',
            data: {
              month: '2026-05',
              budget: { rent: 1000, utilities: 550 },
              budgetSource: 'live',
              spendByCategory: { rent: 1445, utilities: 500 },
              totalSpent: 1945,
              totalBudgeted: 1550,
              monthlyTrend: [],
              savingsRate: null,
              monthlyIncome: null,
              overBudgetCategories: ['rent'],
              byMember: [],
            },
          }),
      ),
    );

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    // 1550 budgeted, 1945 spent → 395 over, 125% used (1945/1550 = 125.5%).
    const status = screen.getByTestId('budget-status');
    expect(status.textContent).toMatch(/395\.00/);
    expect(status.textContent).toMatch(/over/i);
    expect(status.textContent).toMatch(/125%/);
  });

  it('prompts to set a budget when nothing is budgeted', async () => {
    mockState.uiMode = 'couple';
    mockState.financeMode = 'split';
    server.use(
      http.get(
        `http://localhost:3000/api/households/${mockHousehold._id}/budget/insights`,
        () =>
          HttpResponse.json({
            status: 'success',
            data: {
              month: '2026-05',
              budget: {},
              budgetSource: 'live',
              spendByCategory: { rent: 100 },
              totalSpent: 100,
              totalBudgeted: 0,
              monthlyTrend: [],
              savingsRate: null,
              monthlyIncome: null,
              overBudgetCategories: [],
              byMember: [],
            },
          }),
      ),
    );

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    expect(screen.getByTestId('budget-status').textContent).toMatch(/set category budgets/i);
  });
});

describe('BudgetPage roommate mode', () => {
  function installRoommateHandler() {
    server.use(
      http.get(
        `http://localhost:3000/api/households/${mockHousehold._id}/budget/insights`,
        () =>
          HttpResponse.json({
            status: 'success',
            data: {
              month: '2026-05',
              budget: { groceries: 300 },
              budgetSource: 'live',
              spendByCategory: { groceries: 240 },
              totalSpent: 240,
              totalBudgeted: 300,
              monthlyTrend: Array.from({ length: 6 }, (_, i) => ({
                monthString: `2026-0${i + 1}`,
                totalSpent: 0,
              })),
              savingsRate: null,
              monthlyIncome: null,
              overBudgetCategories: [],
              byMember: [
                {
                  memberId: 'mem-alice-001',
                  nickname: 'Alice',
                  totalShare: 80,
                  shareByCategory: { groceries: 80 },
                  totalPaid: 240,
                  paidByCategory: { groceries: 240 },
                },
                {
                  memberId: 'mem-bob-001',
                  nickname: 'Bob',
                  totalShare: 80,
                  shareByCategory: { groceries: 80 },
                  totalPaid: 0,
                  paidByCategory: {},
                },
              ],
              requestedScope: 'household',
              effectiveScope: 'household',
            },
          }),
      ),
    );
  }

  it('equal split: no toggle, no savings card, no income card; shows shared-spending header + per-category your-share subline', async () => {
    mockState.uiMode = 'roommates';
    mockState.financeMode = 'split';
    mockState.splitMethod = 'equal';
    installRoommateHandler();

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    expect(screen.queryByTestId('budget-scope-toggle')).not.toBeInTheDocument();
    // No income-based savings rate, but roommates now DO get the budget-status
    // card (it's budget-scoped, needs no income, and fits a collective view).
    expect(screen.queryByTestId('budget-savings-rate')).not.toBeInTheDocument();
    expect(screen.getByTestId('budget-status')).toBeInTheDocument();
    // IncomeManagementCard renders a "YOUR INCOME" eyebrow — absent for equal split.
    expect(screen.queryByText(/your income/i)).not.toBeInTheDocument();

    expect(screen.getByText(/shared household spending/i)).toBeInTheDocument();

    const myshare = screen.getByTestId('budget-myshare-groceries');
    expect(myshare.textContent ?? '').toMatch(/your share/i);
    expect(myshare).toHaveTextContent('80.00');
  });

  it('income-based split: income card present so they can set the income that drives settlement (still no savings card / toggle)', async () => {
    mockState.uiMode = 'roommates';
    mockState.financeMode = 'split';
    mockState.splitMethod = 'income_based';
    installRoommateHandler();

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    expect(screen.getByText(/your income/i)).toBeInTheDocument();
    expect(screen.queryByTestId('budget-savings-rate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-scope-toggle')).not.toBeInTheDocument();
  });

  it('Spending Breakdown offers a per-member toggle and lists each member', async () => {
    mockState.uiMode = 'roommates';
    mockState.financeMode = 'split';
    mockState.splitMethod = 'equal';
    installRoommateHandler();

    renderWithProviders(<BudgetPage />);
    await screen.findByText('Categories');

    // The per-member toggle is now available to roommates (2+ members).
    expect(screen.getByTestId('breakdown-mode-toggle')).toBeInTheDocument();

    // Switching to "By member" renders one legend row per member.
    fireEvent.click(screen.getByTestId('breakdown-mode-member'));
    expect(
      screen.getByTestId('legend-row-member-mem-alice-001'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('legend-row-member-mem-bob-001'),
    ).toBeInTheDocument();
  });
});
