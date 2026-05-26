import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { RoommatesStatsRow } from '@/components/dashboard/roommates/RoommatesStatsRow';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import {
  mockHouseholdRoommatesJoint,
  mockHouseholdRoommatesSplit,
} from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';
import type { ExpenseResponse } from '@/types/expense.types';

function renderRow(
  household: typeof mockHouseholdRoommatesJoint | typeof mockHouseholdRoommatesSplit,
  expenses: ExpenseResponse[] = []
) {
  // Stub the issue list endpoint that RoommatesStatsRow's <OpenIssuesCard> path
  // hits via useIssues(); keep it empty so the card just shows "0".
  // Also stub DashboardProvider's hoisted queries (tasks, goals, joint-account).
  server.use(
    http.get('*/api/households/:id/issues', () =>
      HttpResponse.json({ items: [], nextCursor: null })
    ),
    http.get('*/api/households/:id/votes', () =>
      HttpResponse.json({ items: [], nextCursor: null })
    ),
    http.get('*/api/households/:id/house-rules', () =>
      HttpResponse.json({ items: [] })
    ),
    http.get('*/api/households/:id/tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [], tasks: [] } })
    ),
    http.get('*/api/households/:id/goals', () =>
      HttpResponse.json({ status: 'success', data: { items: [], goals: [] } })
    ),
    http.get('*/api/households/:id/joint-account', () =>
      HttpResponse.json({ status: 'success', data: { summary: null } })
    )
  );

  return renderWithProviders(
    <DashboardProvider household={household} currentUserId={mockUsers.alice._id}>
      <RoommatesStatsRow expenses={expenses} />
    </DashboardProvider>
  );
}

describe('<RoommatesStatsRow />', () => {
  it('renders settlement matrix card in split mode', async () => {
    renderRow(mockHouseholdRoommatesSplit);
    // SettlementMatrixCard's eyebrow label is the literal text "SETTLEMENT".
    expect(await screen.findByText('SETTLEMENT')).toBeInTheDocument();
  });

  it('hides settlement matrix card in joint mode', async () => {
    renderRow(mockHouseholdRoommatesJoint);
    // OpenIssuesCard is always rendered — wait for it so the row has mounted.
    await screen.findByText(/open issues/i);
    expect(screen.queryByText('SETTLEMENT')).not.toBeInTheDocument();
  });

  it('renders YOUR POSITION block listing the viewer\'s debts (split, 3 roommates)', async () => {
    // Alice (currentUser) pays 300 for groceries. Equal split among 3 → Bob and
    // Carol each owe Alice 100. The greedy settlement yields:
    //   Bob → Alice : 100
    //   Carol → Alice : 100
    // Alice should see two "owes you" rows in the personal block.
    const expenses: ExpenseResponse[] = [
      {
        _id: 'exp-1',
        householdId: mockHouseholdRoommatesSplit._id,
        paidByUserId: mockUsers.alice._id,
        paidByNickname: 'Alice',
        createdByUserId: mockUsers.alice._id,
        description: 'Groceries',
        amount: 300,
        category: 'groceries',
        date: '2026-05-15',
        isResolved: false,
        isFullRepayment: false,
        debtorStates: [],
        createdAt: '2026-05-15T10:00:00.000Z',
        updatedAt: '2026-05-15T10:00:00.000Z',
      },
    ];

    renderRow(mockHouseholdRoommatesSplit, expenses);
    const yourPosition = await screen.findByTestId('settlement-your-position');
    expect(within(yourPosition).getByText(/Bob owes you/i)).toBeInTheDocument();
    expect(within(yourPosition).getByText(/Carol owes you/i)).toBeInTheDocument();
  });
});
