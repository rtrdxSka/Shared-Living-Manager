import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import OverBudgetBanner from '../OverBudgetBanner';

const URL = 'http://localhost:3000/api/households/h1/budget/insights';

function mockInsights(overrides: Record<string, unknown>) {
  server.use(
    http.get(URL, () =>
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
          ...overrides,
        },
      }),
    ),
  );
}

describe('OverBudgetBanner', () => {
  it('renders nothing when no over-budget categories', async () => {
    mockInsights({});
    const { container } = renderWithProviders(
      <OverBudgetBanner householdId="h1" currency="EUR" />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent ?? '').toBe('');
  });

  it('renders the editorial card with hero amount, eyebrow, and per-category breakdown', async () => {
    mockInsights({
      budget: { groceries: 300, utilities: 130 },
      spendByCategory: { groceries: 380, utilities: 170 },
      totalSpent: 550,
      totalBudgeted: 430,
      overBudgetCategories: ['groceries', 'utilities'],
    });
    renderWithProviders(<OverBudgetBanner householdId="h1" currency="EUR" />);

    expect(await screen.findByTestId('over-budget-banner')).toBeInTheDocument();
    expect(screen.getByText(/OVER BUDGET/)).toBeInTheDocument();

    // Hero amount: groceries 80 + utilities 40 = 120
    expect(screen.getByTestId('over-budget-hero')).toHaveTextContent(/120/);
    expect(screen.getByText(/across 2 categories/i)).toBeInTheDocument();

    // Categories rendered, sorted descending by overshoot (groceries 80 > utilities 40)
    const rows = screen.getAllByTestId(/^over-item-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'over-item-groceries');
    expect(rows[1]).toHaveAttribute('data-testid', 'over-item-utilities');

    // Per-row deltas
    expect(screen.getByTestId('over-delta-groceries')).toHaveTextContent('+80');
    expect(screen.getByTestId('over-delta-utilities')).toHaveTextContent('+40');

    // Action link present
    expect(screen.getByText(/view budget breakdown/i)).toBeInTheDocument();
  });

  it('uses severe (neg) tone when a category is more than 50% over budget', async () => {
    mockInsights({
      // groceries: budget 100, spent 250 → 150% over → SEVERE
      // utilities: budget 100, spent 120 → 20% over → not severe
      budget: { groceries: 100, utilities: 100 },
      spendByCategory: { groceries: 250, utilities: 120 },
      totalSpent: 370,
      totalBudgeted: 200,
      overBudgetCategories: ['groceries', 'utilities'],
    });
    renderWithProviders(<OverBudgetBanner householdId="h1" currency="EUR" />);

    await screen.findByTestId('over-budget-banner');

    // Severe → text-neg, overshoot bar has bg-neg
    expect(screen.getByTestId('over-delta-groceries').className).toMatch(/text-neg/);
    expect(screen.getByTestId('over-bar-overshoot-groceries').className).toMatch(/bg-neg/);

    // Mild → text-warn, overshoot bar has bg-warn/60
    expect(screen.getByTestId('over-delta-utilities').className).toMatch(/text-warn/);
    expect(screen.getByTestId('over-bar-overshoot-utilities').className).toMatch(/bg-warn\/60/);
  });
});
