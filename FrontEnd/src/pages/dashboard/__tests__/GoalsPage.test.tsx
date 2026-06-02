import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import GoalsPage from '@/pages/dashboard/GoalsPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import type { GoalResponse } from '@/types/goal.types';

const mockGoals: GoalResponse[] = [
  {
    _id: 'g1',
    householdId: mockHousehold._id,
    name: 'Vacation Fund',
    targetAmount: 2000,
    currentAmount: 500,
    status: 'active',
    category: 'travel',
    priority: 'normal',
    createdByUserId: 'user-alice-001',
    contributions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mutable reference so individual tests can swap the goals list
const dashboardOverride: { goals: GoalResponse[] } = { goals: [] };

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
      goals: dashboardOverride.goals,
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

beforeEach(() => {
  dashboardOverride.goals = [];

  server.use(
    http.get('http://localhost:3000/api/households/:id/goals', () =>
      HttpResponse.json({
        status: 'success',
        data: { goals: mockGoals },
      }),
    ),
  );
});

describe('<GoalsPage />', () => {
  it('renders the heading and add button', async () => {
    renderWithProviders(<GoalsPage />);
    expect(await screen.findByRole('heading', { name: /^goals$/i, level: 1 })).toBeInTheDocument();
    // Multiple "Add Goal" buttons may appear (toolbar + empty state)
    const buttons = screen.getAllByRole('button', { name: /add goal/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows goals from the context', async () => {
    dashboardOverride.goals = mockGoals;
    renderWithProviders(<GoalsPage />);
    await waitFor(() => expect(screen.getByText(/vacation fund/i)).toBeInTheDocument());
  });
});
