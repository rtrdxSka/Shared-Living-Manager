import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ExpensesPage from '@/pages/dashboard/ExpensesPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold, mockHouseholdJoint } from '@/test/mocks/data/households';

// Mutable reference so individual tests can swap the household variant
const dashboardOverride: { household: typeof mockHousehold } = { household: mockHousehold };

vi.mock('@/contexts/DashboardContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/DashboardContext')>(
    '@/contexts/DashboardContext',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: dashboardOverride.household,
      currentUserId: 'user-alice-001',
      myMember: dashboardOverride.household.members[0],
      partnerMember: dashboardOverride.household.members[1],
      myNickname: 'Alice',
      partnerNickname: 'Bob',
      currency: 'EUR',
      myMemberId: 'mem-alice-001',
      isAdmin: true,
      myParticipatesInFinances: true,
      hasFinancialPartner: true,
      taskMembers: dashboardOverride.household.members,
      financeMode: dashboardOverride.household.settings.financeMode,
      splitMethod: dashboardOverride.household.settings.expenseSplitMethod || 'equal',
      customMyPct: 50,
      setCustomMyPct: vi.fn(),
      handleCustomPctCommit: vi.fn(),
      incomeSplit: { myPct: 60, partnerPct: 40 },
      taskLevel: 'full',
      distribution: 'rotation',
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
    }),
  };
});

beforeEach(() => {
  // Reset to split-mode household before each test
  dashboardOverride.household = mockHousehold;

  server.use(
    // Expenses list (infinite query)
    http.get('http://localhost:3000/api/households/:id/expenses', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            {
              _id: 'e1',
              description: 'April rent',
              amount: 800,
              category: 'rent',
              date: '2026-05-01',
              paidBy: 'user-alice-001',
              paidByUserId: 'user-alice-001',
              paidByNickname: 'Alice',
              isResolved: false,
              isFullRepayment: false,
              createdByUserId: 'user-alice-001',
            },
            {
              _id: 'e2',
              description: 'Groceries — week 1',
              amount: 120,
              category: 'groceries',
              date: '2026-05-03',
              paidBy: 'user-bob-001',
              paidByUserId: 'user-bob-001',
              paidByNickname: 'Bob',
              isResolved: false,
              isFullRepayment: false,
              createdByUserId: 'user-bob-001',
            },
          ],
          nextCursor: null,
          total: 2,
        },
      }),
    ),
    // Recurring expenses list
    http.get('http://localhost:3000/api/households/:id/recurring-expenses', () =>
      HttpResponse.json({
        success: true,
        data: { items: [] },
      }),
    ),
    // Member income (rendered by IncomeManagementCard for income_based split)
    http.get('http://localhost:3000/api/households/:id/members/income', () =>
      HttpResponse.json({
        success: true,
        data: { members: [] },
      }),
    ),
    // Joint account summary — stubbed for safety
    http.get('http://localhost:3000/api/households/:id/joint-account', () =>
      HttpResponse.json({
        success: true,
        data: { summary: null },
      }),
    ),
  );
});

describe('<ExpensesPage />', () => {
  it('renders the page heading and add expense button', async () => {
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByRole('heading', { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ add expense/i })).toBeInTheDocument();
  });

  it('shows expense rows from the API', async () => {
    renderWithProviders(<ExpensesPage />);
    await waitFor(() => {
      const matches = screen.getAllByText(/groceries — week 1|april rent/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('hides the OUTSTANDING section when financeMode is "joint"', async () => {
    dashboardOverride.household = mockHouseholdJoint;
    renderWithProviders(<ExpensesPage />);
    // Wait for the page to finish rendering (heading confirms it mounted)
    await screen.findByRole('heading', { name: /expenses/i });
    // The OUTSTANDING eyebrow label must not appear in joint mode
    expect(screen.queryByText('OUTSTANDING')).not.toBeInTheDocument();
  });
});
