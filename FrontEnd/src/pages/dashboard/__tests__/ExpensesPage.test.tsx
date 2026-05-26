import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ExpensesPage from '@/pages/dashboard/ExpensesPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold, mockHouseholdJoint } from '@/test/mocks/data/households';

// Mutable reference so individual tests can swap the household variant
// or impersonate a different user (for authorization-gating tests).
const dashboardOverride: {
  household: typeof mockHousehold;
  currentUserId: string;
  myMember: typeof mockHousehold.members[number];
  myNickname: string;
  myMemberId: string;
  isAdmin: boolean;
} = {
  household: mockHousehold,
  currentUserId: 'user-alice-001',
  myMember: mockHousehold.members[0],
  myNickname: 'Alice',
  myMemberId: 'mem-alice-001',
  isAdmin: true,
};

vi.mock('@/contexts/useDashboard', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/useDashboard')>(
    '@/contexts/useDashboard',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: dashboardOverride.household,
      currentUserId: dashboardOverride.currentUserId,
      myMember: dashboardOverride.myMember,
      partnerMember: dashboardOverride.household.members[1],
      myNickname: dashboardOverride.myNickname,
      partnerNickname: 'Bob',
      currency: 'EUR',
      myMemberId: dashboardOverride.myMemberId,
      uiMode: dashboardOverride.household.uiMode ?? 'couple',
      isAdmin: dashboardOverride.isAdmin,
      myParticipatesInFinances: true,
      hasFinancialPartner: true,
      taskMembers: dashboardOverride.household.members,
      financeMode: dashboardOverride.household.settings.financeMode,
      splitMethod: dashboardOverride.household.settings.expenseSplitMethod || 'equal',
      customMyPct: 50,
      setCustomMyPct: vi.fn(),
      handleCustomPctCommit: vi.fn(),
      customShares: dashboardOverride.household.members
        .filter((m) => m.participatesInFinances && m.userId)
        .map((m) => ({ userId: m.userId as string, nickname: m.nickname, pct: 0 })),
      handleCustomSharesCommit: vi.fn(),
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
    }),
  };
});

beforeEach(() => {
  // Reset to split-mode household viewed as Alice (owner) before each test
  dashboardOverride.household = mockHousehold;
  dashboardOverride.currentUserId = 'user-alice-001';
  dashboardOverride.myMember = mockHousehold.members[0];
  dashboardOverride.myNickname = 'Alice';
  dashboardOverride.myMemberId = 'mem-alice-001';
  dashboardOverride.isAdmin = true;

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

  it('BY CATEGORY shows the viewer\'s per-share total, not the full expense amount (split/equal)', async () => {
    // Fixture: 800 rent paid by Alice + 120 groceries paid by Bob.
    // mockHousehold is split/equal → Alice's share = 400 (rent) + 60 (groceries) = 460.
    renderWithProviders(<ExpensesPage />);
    await screen.findByRole('heading', { name: /expenses/i });

    // The rent category row in the right-rail BY CATEGORY breakdown must show
    // Alice's share (400), not the household total (800).
    const rentTotal = await screen.findByTestId('cat-total-rent');
    expect(rentTotal.textContent).toContain('400');
    expect(rentTotal.textContent).not.toContain('800');

    // Groceries row should show 60 (half of 120), not 120.
    const groceriesTotal = await screen.findByTestId('cat-total-groceries');
    expect(groceriesTotal.textContent).toContain('60');
  });
});

describe('<ExpensesPage /> expense action gating (roommates)', () => {
  // 3-member roommates household: Alice (owner), Bob (admin), Carol (member).
  // Override the standard 2-person mockHousehold so isAdmin variations have
  // meaning and we can impersonate a non-creator member.
  const roommatesHousehold = {
    ...mockHousehold,
    _id: 'hh-roommates-auth',
    livingArrangement: 'roommates',
    uiMode: 'roommates',
    totalMembers: 3,
    members: [
      { ...mockHousehold.members[0], role: 'owner' },
      { ...mockHousehold.members[1], role: 'admin' },
      {
        _id: 'mem-carol-001',
        userId: 'user-carol-001',
        nickname: 'Carol',
        role: 'member',
        ageGroup: 'adult',
        relationship: 'roommate',
        isCreator: false,
        participatesInFinances: true,
        participatesInTasks: true,
        monthlyIncome: 2500,
        joinedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
    settings: {
      ...mockHousehold.settings,
      financeMode: 'split',
      expenseSplitMethod: 'equal',
    },
  } as unknown as typeof mockHousehold;

  // Carol-created unsettled expense (paid by Carol). Used to verify what
  // each viewer sees in the action area.
  const carolExpense = {
    _id: 'exp-carol-001',
    description: 'Pizza',
    amount: 60,
    category: 'groceries',
    date: '2026-05-15',
    paidBy: 'user-carol-001',
    paidByUserId: 'user-carol-001',
    paidByNickname: 'Carol',
    isResolved: false,
    isFullRepayment: false,
    createdByUserId: 'user-carol-001',
    debtorStates: [
      { userId: 'user-alice-001', share: 20 },
      { userId: 'user-bob-001', share: 20 },
    ],
  };

  function installCarolExpenseHandler() {
    server.use(
      http.get('http://localhost:3000/api/households/:id/expenses', () =>
        HttpResponse.json({
          success: true,
          data: { items: [carolExpense], nextCursor: null, total: 1 },
        }),
      ),
      http.get('http://localhost:3000/api/households/:id/recurring-expenses', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
    );
  }

  it('member (non-creator, non-admin) sees no Edit or Delete on someone else\'s expense', async () => {
    // Impersonate Bob the admin — wait no, we need a member. Carol can't be the
    // viewer here because she created the expense. Use Alice but force isAdmin=false.
    dashboardOverride.household = roommatesHousehold;
    dashboardOverride.currentUserId = 'user-alice-001';
    dashboardOverride.myMember = roommatesHousehold.members[0];
    dashboardOverride.myNickname = 'Alice';
    dashboardOverride.myMemberId = 'mem-alice-001';
    dashboardOverride.isAdmin = false; // <-- non-admin viewer of someone else's expense

    installCarolExpenseHandler();
    renderWithProviders(<ExpensesPage />);
    // Wait for the expense row to mount, then expand it.
    const row = await screen.findByText(/Pizza/);
    row.click();
    // Neither Edit nor Delete should be in the action area.
    expect(screen.queryByRole('button', { name: /edit expense/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete expense/i })).not.toBeInTheDocument();
  });

  it('admin non-creator can delete (but not edit) someone else\'s expense', async () => {
    dashboardOverride.household = roommatesHousehold;
    dashboardOverride.currentUserId = 'user-bob-001';
    dashboardOverride.myMember = roommatesHousehold.members[1];
    dashboardOverride.myNickname = 'Bob';
    dashboardOverride.myMemberId = 'mem-bob-001';
    dashboardOverride.isAdmin = true; // <-- admin viewer

    installCarolExpenseHandler();
    renderWithProviders(<ExpensesPage />);
    const row = await screen.findByText(/Pizza/);
    row.click();
    // Admin can delete (override added in this fix).
    expect(await screen.findByRole('button', { name: /delete expense/i })).toBeInTheDocument();
    // But cannot edit — edit stays creator-only.
    expect(screen.queryByRole('button', { name: /edit expense/i })).not.toBeInTheDocument();
  });
});
