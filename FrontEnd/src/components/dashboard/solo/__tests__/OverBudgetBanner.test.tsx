import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import OverBudgetBanner from '../OverBudgetBanner';

describe('OverBudgetBanner', () => {
  it('renders nothing when no over-budget categories', async () => {
    server.use(
      http.get('http://localhost:3000/api/households/h1/budget/insights', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            month: '2026-05',
            budget: {},
            budgetSource: 'live',
            spendByCategory: {},
            totalSpent: 0,
            totalBudgeted: 0,
            monthlyTrend: [],
            savingsRate: null,
            monthlyIncome: null,
            overBudgetCategories: [],
          },
        })
      )
    );
    const { container } = renderWithProviders(<OverBudgetBanner householdId="h1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent ?? '').toBe('');
  });

  it('renders an alert when categories are over', async () => {
    server.use(
      http.get('http://localhost:3000/api/households/h1/budget/insights', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            month: '2026-05',
            budget: { groceries: 100 },
            budgetSource: 'live',
            spendByCategory: { groceries: 200 },
            totalSpent: 200,
            totalBudgeted: 100,
            monthlyTrend: [],
            savingsRate: null,
            monthlyIncome: null,
            overBudgetCategories: ['groceries'],
          },
        })
      )
    );
    renderWithProviders(<OverBudgetBanner householdId="h1" />);
    expect(await screen.findByText(/over budget/i)).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
