import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import OverviewPage from '@/pages/dashboard/OverviewPage';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

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
});
