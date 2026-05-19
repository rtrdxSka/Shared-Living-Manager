import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpendingBreakdownCard from '@/components/dashboard/solo/SpendingBreakdownCard';
import type { BudgetInsights } from '@/types/budget.types';

function makeData(overrides: Partial<BudgetInsights> = {}): BudgetInsights {
  return {
    month: '2026-05',
    budget: { rent: 1500, groceries: 300, utilities: 150 },
    budgetSource: 'live',
    spendByCategory: { rent: 1200, groceries: 380, utilities: 120 },
    totalSpent: 1700,
    totalBudgeted: 1950,
    monthlyTrend: [],
    savingsRate: null,
    monthlyIncome: null,
    overBudgetCategories: ['groceries'],
    ...overrides,
  };
}

describe('<SpendingBreakdownCard />', () => {
  it('renders legend rows sorted by spend descending', () => {
    render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);

    const rows = screen.getAllByTestId(/^legend-row-/);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-testid', 'legend-row-rent');
    expect(rows[1]).toHaveAttribute('data-testid', 'legend-row-groceries');
    expect(rows[2]).toHaveAttribute('data-testid', 'legend-row-utilities');
  });

  it('renders percent of total for each legend row', () => {
    render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);

    // Rent: 1200 / 1700 = 70.59% → rounded 71%
    expect(screen.getByText('71%')).toBeInTheDocument();
    // Groceries: 380 / 1700 = 22.35% → rounded 22%
    expect(screen.getByText('22%')).toBeInTheDocument();
    // Utilities: 120 / 1700 = 7.05% → rounded 7%
    expect(screen.getByText('7%')).toBeInTheDocument();
  });

  it('renders the top-category callout with largest category and its percent', () => {
    render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);

    const top = screen.getByTestId('top-callout');
    expect(top).toHaveTextContent('Top:');
    expect(top).toHaveTextContent('Rent');
    expect(top).toHaveTextContent('(71%)');
  });

  it('renders over-budget chips for each over-budget category', () => {
    render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);

    expect(screen.getByTestId('over-budget-chips')).toBeInTheDocument();
    expect(screen.getByTestId('over-chip-groceries')).toHaveTextContent('Groceries');
    expect(screen.queryByTestId('over-chip-rent')).not.toBeInTheDocument();
  });

  it('hides the over-budget section when no categories are over budget', () => {
    render(
      <SpendingBreakdownCard
        data={makeData({ overBudgetCategories: [] })}
        currency="EUR"
      />,
    );
    expect(screen.queryByTestId('over-budget-chips')).not.toBeInTheDocument();
  });

  it('falls back to empty state when no spending this month', () => {
    render(
      <SpendingBreakdownCard
        data={makeData({ spendByCategory: {}, totalSpent: 0, overBudgetCategories: [] })}
        currency="EUR"
      />,
    );
    expect(screen.getByText(/no spending this month/i)).toBeInTheDocument();
    expect(screen.queryByTestId('top-callout')).not.toBeInTheDocument();
  });
});
