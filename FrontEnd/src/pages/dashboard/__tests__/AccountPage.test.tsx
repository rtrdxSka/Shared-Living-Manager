import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AccountPage from '@/pages/dashboard/AccountPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

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
      // Must be 'joint' — AccountPage redirects to /expenses when 'split'
      financeMode: 'joint',
      splitMethod: 'equal',
      taskLevel: 'full',
      distribution: 'rotation',
      customMyPct: 50,
      setCustomMyPct: vi.fn(),
      incomeSplit: { myPct: 50, partnerPct: 50 },
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

const MOCK_SUMMARY = {
  balance: 1500,
  monthlyDeposits: 800,
  monthlyWithdrawals: 100,
  monthlyExpenses: 200,
  monthlyNet: 500,
  monthlyTarget: 2000,
  targetMode: 'equal',
  memberBreakdown: [],
  transactions: [],
  transactionTotal: 0,
  transactionPage: 1,
  transactionTotalPages: 1,
};

beforeEach(() => {
  server.use(
    http.get('http://localhost:3000/api/households/:id/joint-account', () =>
      HttpResponse.json({
        status: 'success',
        data: { summary: MOCK_SUMMARY },
      }),
    ),
  );
});

describe('<AccountPage />', () => {
  it('renders the "Joint Account" heading', async () => {
    renderWithProviders(<AccountPage />);
    expect(
      await screen.findByRole('heading', { name: /joint account/i }),
    ).toBeInTheDocument();
  });

  it('shows Deposit and Withdraw action buttons', async () => {
    renderWithProviders(<AccountPage />);
    expect(await screen.findByRole('button', { name: /^deposit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeInTheDocument();
  });
});
