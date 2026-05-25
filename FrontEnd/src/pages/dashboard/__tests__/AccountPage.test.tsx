import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AccountPage from '@/pages/dashboard/AccountPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

vi.mock('@/contexts/useDashboard', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/useDashboard')>(
    '@/contexts/useDashboard',
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

const MOCK_SUMMARY = {
  balance: 1500,
  monthlyDeposits: 800,
  monthlyWithdrawals: 100,
  monthlyExpenses: 200,
  monthlyNet: 500,
  monthlyTarget: 2000,
  targetMode: 'equal',
  memberBreakdown: [
    { memberId: 'mem-alice-001', nickname: 'Alice', deposits: 600, withdrawals: 0, targetAmount: 600 },
    { memberId: 'mem-bob-001', nickname: 'Bob', deposits: 600, withdrawals: 0, targetAmount: 600 },
    { memberId: 'mem-carol-001', nickname: 'Carol', deposits: 600, withdrawals: 0, targetAmount: 600 },
  ],
  transactions: [],
  transactionTotal: 0,
  transactionPage: 1,
  transactionTotalPages: 1,
  activity: [
    {
      _id: 'tx-1',
      kind: 'transaction',
      type: 'deposit',
      amount: 800,
      date: '2026-05-10T10:00:00.000Z',
      memberNickname: 'Alice',
      note: 'Payday top-up',
    },
    {
      _id: 'exp-1',
      kind: 'expense',
      type: 'expense',
      amount: 200,
      date: '2026-05-08T18:00:00.000Z',
      memberNickname: 'Bob',
      note: 'Weekly groceries',
      category: 'groceries',
    },
  ],
  activityTotal: 2,
  activityPage: 1,
  activityTotalPages: 1,
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

describe('<AccountPage /> Recent Activity (unified feed)', () => {
  it('renders expenses merged into Recent Activity alongside transactions', async () => {
    renderWithProviders(<AccountPage />);
    // The expense (description) and the transaction (note) both appear in the feed.
    expect(await screen.findByText(/Weekly groceries/i)).toBeInTheDocument();
    expect(screen.getByText(/Payday top-up/i)).toBeInTheDocument();
  });

  it('surfaces monthly expenses in the hero so the balance drop is explained', async () => {
    renderWithProviders(<AccountPage />);
    // monthlyExpenses = 200 → hero subline mentions the spend.
    expect(await screen.findByText(/spent this month/i)).toBeInTheDocument();
  });

  it('expense items are read-only — delete control only on transactions', async () => {
    renderWithProviders(<AccountPage />);
    await screen.findByText(/Weekly groceries/i);
    // One transaction + one expense in the feed, but only the transaction is deletable.
    expect(screen.getAllByTitle('Delete transaction')).toHaveLength(1);
  });
});

describe('<AccountPage /> contribution bars', () => {
  it('colors every member bar with the neutral accent — no red alarm bar', async () => {
    renderWithProviders(<AccountPage />);
    await screen.findByText(/contributions this month/i);
    const bars = screen.getAllByTestId('contrib-bar');
    // One bar per member in the breakdown (3).
    expect(bars.length).toBe(3);
    bars.forEach((bar) => {
      // Regression: no member's bar should use the salmon-red cat-rent color.
      expect(bar.className).not.toMatch(/cat-rent/);
      expect(bar.className).toMatch(/bg-accent/);
    });
  });
});
