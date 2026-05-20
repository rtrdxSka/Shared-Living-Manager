import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import ShoppingListPage from '@/pages/dashboard/ShoppingListPage';
import { server } from '@/test/mocks/server';
import { createTestQueryClient } from '@/test/utils/test-query-client';
import { mockHousehold } from '@/test/mocks/data/households';

/** Renders ShoppingListPage inside a data router (required for useBlocker). */
function renderShoppingListPage() {
  const router = createMemoryRouter([{ path: '/', element: <ShoppingListPage /> }], {
    initialEntries: ['/'],
  });
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

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

beforeEach(() => {
  server.use(
    // Active shopping list (infinite query — GET /households/:id/shopping-list)
    http.get('http://localhost:3000/api/households/:id/shopping-list', ({ request }) => {
      const url = new URL(request.url);
      const boughtState = url.searchParams.get('boughtState');
      if (boughtState === 'bought') {
        // useBoughtShoppingItems query
        return HttpResponse.json({
          success: true,
          data: { items: [], nextCursor: null },
        });
      }
      return HttpResponse.json({
        success: true,
        data: {
          items: [
            { _id: 'i1', name: 'Milk', category: 'groceries', isBought: false },
          ],
          nextCursor: null,
        },
      });
    }),
    // Recurring shopping rules
    http.get('http://localhost:3000/api/households/:id/shopping-list/recurring', () =>
      HttpResponse.json({
        success: true,
        data: { items: [] },
      }),
    ),
  );
});

describe('<ShoppingListPage />', () => {
  it('renders the heading and add item button', async () => {
    renderShoppingListPage();
    expect(await screen.findByRole('heading', { name: /shopping list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('renders the Active, History and Recurring tabs', async () => {
    renderShoppingListPage();
    expect(await screen.findByRole('tab', { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recurring/i })).toBeInTheDocument();
  });

  it('shows items from the API', async () => {
    renderShoppingListPage();
    await waitFor(() => expect(screen.getByText(/milk/i)).toBeInTheDocument());
  });
});
