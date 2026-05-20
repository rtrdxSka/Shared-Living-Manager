import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import TasksPage from '@/pages/dashboard/TasksPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

// Mutable reference so individual tests can swap the tasks list
const dashboardOverride = {
  tasks: [] as {
    _id: string;
    title: string;
    isCompleted: boolean;
    createdByUserId: string;
    completedByNickname?: string;
    completedAt?: string;
    completedByMemberId?: string;
  }[],
};

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
      tasks: dashboardOverride.tasks,
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

const MOCK_TASKS = [
  {
    _id: 't1',
    title: 'Wash the dishes',
    isCompleted: false,
    createdByUserId: 'user-alice-001',
  },
  {
    _id: 't2',
    title: 'Vacuum the living room',
    isCompleted: true,
    createdByUserId: 'user-bob-001',
    completedByNickname: 'Bob',
    completedAt: new Date(Date.now() - 1000).toISOString(),
    completedByMemberId: 'mem-bob-001',
  },
];

beforeEach(() => {
  // Reset to empty tasks before each test
  dashboardOverride.tasks = [];

  server.use(
    // Tasks list (infinite query — GET /households/:id/tasks)
    http.get('http://localhost:3000/api/households/:id/tasks', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: MOCK_TASKS,
          nextCursor: null,
        },
      }),
    ),
    // Recurring tasks list
    http.get('http://localhost:3000/api/households/:id/recurring-tasks', () =>
      HttpResponse.json({
        success: true,
        data: { items: [] },
      }),
    ),
  );
});

describe('<TasksPage />', () => {
  it('renders the page heading and add task button', async () => {
    renderWithProviders(<TasksPage />);
    expect(await screen.findByRole('heading', { name: /tasks/i })).toBeInTheDocument();
    // Multiple "Add task" buttons may appear (toolbar + empty-state action)
    const addTaskButtons = screen.getAllByRole('button', { name: /add task/i });
    expect(addTaskButtons.length).toBeGreaterThan(0);
  });

  it('shows tasks from the context', async () => {
    dashboardOverride.tasks = MOCK_TASKS;
    renderWithProviders(<TasksPage />);
    await waitFor(() => expect(screen.getByText(/wash the dishes/i)).toBeInTheDocument());
    expect(screen.getByText(/vacuum the living room/i)).toBeInTheDocument();
  });
});
