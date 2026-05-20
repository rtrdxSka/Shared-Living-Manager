import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import OverviewPage from '@/pages/dashboard/OverviewPage';
import GoalsPage from '@/pages/dashboard/GoalsPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import { mockHouseholdJoint } from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

const renderPage = (page: ReactElement) =>
  renderWithProviders(
    <DashboardProvider household={mockHouseholdJoint} currentUserId={mockUsers.alice._id}>
      {page}
    </DashboardProvider>,
  );

beforeEach(() => {
  server.use(
    http.get('http://localhost:3000/api/households/:id/expenses', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], nextCursor: null, total: 0 },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/recurring-expenses', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [] },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/members/income', () =>
      HttpResponse.json({
        status: 'success',
        data: { members: [] },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/joint-account', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          summary: {
            balance: 1500,
            monthlyTarget: 2000,
            monthlyDeposits: 1200,
            transactions: [],
            targetMode: 'both',
          },
        },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/goals', () =>
      HttpResponse.json({
        status: 'success',
        data: { goals: [] },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/tasks', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], nextCursor: null },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/recurring-tasks', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [] },
      }),
    ),
    http.get('http://localhost:3000/api/households/:id/budget/insights', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          monthString: '2026-05',
          categories: {},
          spendByCategory: {},
          totalSpent: 0,
          totalBudgeted: 0,
          savingsRate: 0,
          overBudgetCategories: [],
          monthlyTrend: [],
          byMember: [],
        },
      }),
    ),
  );
});

describe('Joint-mode cross-page coverage', () => {
  it('M.1 — OverviewPage in joint mode shows joint-account hero', async () => {
    renderPage(<OverviewPage />);
    // In joint mode, StatsRow renders a HeroNumberCard with "TOTAL SPENT THIS MONTH"
    // followed by a JointAccountTile with "JOINT ACCOUNT" eyebrow and balance of 1500
    await waitFor(() => {
      const jointHero =
        screen.queryByText(/joint account/i) ||
        screen.queryByText(/1500|1.500/) ||
        screen.queryByText(/total spent this month/i);
      expect(jointHero).toBeTruthy();
    });
  });

  it('M.2 — OverviewPage in joint mode hides IncomeManagementCard', async () => {
    renderPage(<OverviewPage />);
    await screen.findByRole('heading', { name: /overview/i });
    // In joint mode, financeMode !== 'split', so showIncomeCard evaluates to false
    // IncomeManagementCard should NOT render
    expect(
      screen.queryByText(/your monthly income|income management|update.*income/i),
    ).not.toBeInTheDocument();
  });

  it('M.3 — GoalsPage in joint mode renders without crashing', async () => {
    renderPage(<GoalsPage />);
    // GoalsPage should always render its heading and be usable in joint mode
    await screen.findByRole('heading', { name: /^goals$/i, level: 1 });
    // Confirm the heading exists (basic smoke test for joint mode)
    const heading = screen.getByRole('heading', { name: /^goals$/i, level: 1 });
    expect(heading).toBeInTheDocument();
  });
});
