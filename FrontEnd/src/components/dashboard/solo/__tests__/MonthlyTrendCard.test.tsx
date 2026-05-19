import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthlyTrendCard from '@/components/dashboard/solo/MonthlyTrendCard';
import type { BudgetInsights } from '@/types/budget.types';

function makeData(trend: Array<[string, number]>, overrides: Partial<BudgetInsights> = {}): BudgetInsights {
  return {
    month: '2026-05',
    budget: {},
    budgetSource: 'live',
    spendByCategory: {},
    totalSpent: 0,
    totalBudgeted: 0,
    monthlyTrend: trend.map(([monthString, totalSpent]) => ({ monthString, totalSpent })),
    savingsRate: null,
    monthlyIncome: null,
    overBudgetCategories: [],
    ...overrides,
  };
}

describe('<MonthlyTrendCard />', () => {
  it('renders 6 short month labels in chronological order', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    expect(screen.getByTestId('month-label-0')).toHaveTextContent(/dec/i);
    expect(screen.getByTestId('month-label-1')).toHaveTextContent(/jan/i);
    expect(screen.getByTestId('month-label-2')).toHaveTextContent(/feb/i);
    expect(screen.getByTestId('month-label-3')).toHaveTextContent(/mar/i);
    expect(screen.getByTestId('month-label-4')).toHaveTextContent(/apr/i);
    expect(screen.getByTestId('month-label-5')).toHaveTextContent(/may/i);
  });

  it('renders MoM delta with positive sign + neg tone when current > prior', () => {
    const data = makeData([
      ['2025-12', 100],
      ['2026-01', 100],
      ['2026-02', 100],
      ['2026-03', 100],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    const delta = screen.getByTestId('mom-delta');
    expect(delta).toHaveTextContent(/\+12% vs apr/i);
    expect(delta).toHaveClass('text-neg');
  });

  it('renders MoM delta with Unicode minus + pos tone when current < prior', () => {
    const data = makeData([
      ['2025-12', 100],
      ['2026-01', 100],
      ['2026-02', 100],
      ['2026-03', 100],
      ['2026-04', 1000],
      ['2026-05', 800],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    const delta = screen.getByTestId('mom-delta');
    expect(delta).toHaveTextContent(/−20% vs apr/i);
    expect(delta).toHaveClass('text-pos');
  });

  it('renders "new this month" when prior is zero and current is positive', () => {
    const data = makeData([
      ['2025-12', 0],
      ['2026-01', 0],
      ['2026-02', 0],
      ['2026-03', 0],
      ['2026-04', 0],
      ['2026-05', 500],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    expect(screen.getByTestId('mom-delta')).toHaveTextContent(/new this month/i);
  });

  it('renders current-month footer with full label and amount', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    const footer = screen.getByTestId('current-month-footer');
    expect(footer).toHaveTextContent(/may 2026/i);
    expect(footer).toHaveTextContent('1568.00 EUR');
  });

  it('omits MoM delta when only one trend point is provided', () => {
    const data = makeData([['2026-05', 800]]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    expect(screen.queryByTestId('mom-delta')).not.toBeInTheDocument();
  });

  it('falls back to empty state when all trend values are zero', () => {
    const data = makeData([
      ['2025-12', 0],
      ['2026-01', 0],
      ['2026-02', 0],
      ['2026-03', 0],
      ['2026-04', 0],
      ['2026-05', 0],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    expect(screen.getByText(/no trend data yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('mom-delta')).not.toBeInTheDocument();
  });
});
