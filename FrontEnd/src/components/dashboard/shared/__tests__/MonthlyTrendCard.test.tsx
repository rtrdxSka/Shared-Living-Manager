import { describe, it, expect } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import MonthlyTrendCard from '@/components/dashboard/shared/MonthlyTrendCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { BudgetInsights } from '@/types/budget.types';

// MonthlyTrendCard now contains a Radix Tooltip — wrap every render in a TooltipProvider.
function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

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
    byMember: [],
    requestedScope: 'personal',
    effectiveScope: 'personal',
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

  it('footer at rest lists every month that has spend, excluding zero months', () => {
    const data = makeData([
      ['2025-12', 0],
      ['2026-01', 0],
      ['2026-02', 0],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);

    const footer = screen.getByTestId('trend-footer');
    // Months with spend appear with their short label + amount.
    expect(footer).toHaveTextContent(/mar 2026/i);
    expect(footer).toHaveTextContent('1300.00 EUR');
    expect(footer).toHaveTextContent(/apr 2026/i);
    expect(footer).toHaveTextContent('1400.00 EUR');
    expect(footer).toHaveTextContent(/may 2026/i);
    expect(footer).toHaveTextContent('1568.00 EUR');
    // Zero-spend months are omitted from the at-rest list.
    expect(footer).not.toHaveTextContent(/dec 2025/i);
    expect(footer).not.toHaveTextContent(/jan 2026/i);
  });

  it('footer collapses to the single hovered month in full form', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    const { container } = render(<MonthlyTrendCard data={data} currency="EUR" />);

    fireEvent.mouseEnter(container.querySelector('[data-bar-index="4"]')!);

    const footer = screen.getByTestId('trend-footer');
    expect(footer).toHaveTextContent('April 2026');
    expect(footer).toHaveTextContent('1400.00 EUR');
    // Collapsed: other months are no longer listed.
    expect(footer).not.toHaveTextContent(/dec 2025/i);
    expect(footer).not.toHaveTextContent('1568.00 EUR');
  });

  it('footer restores the multi-month list when the pointer leaves', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    render(<MonthlyTrendCard data={data} currency="EUR" />);
    const aprLabel = screen.getByTestId('month-label-4');

    fireEvent.mouseEnter(aprLabel);
    fireEvent.mouseLeave(aprLabel);

    const footer = screen.getByTestId('trend-footer');
    // Back to the at-rest list: latest + an earlier month both present.
    expect(footer).toHaveTextContent(/dec 2025/i);
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

  it('highlights the matching bar when a month label is hovered', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    const { container } = render(<MonthlyTrendCard data={data} currency="EUR" />);
    const febLabel = screen.getByTestId('month-label-2');

    fireEvent.mouseEnter(febLabel);

    const activeBar = container.querySelector<HTMLElement>('[data-bar-index="2"]')!;
    expect(activeBar.style.transform).toBe('scaleY(1.15)');
  });

  it('shows the value of the active bar in the value label overlay', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    const { container } = render(<MonthlyTrendCard data={data} currency="EUR" />);

    fireEvent.mouseEnter(container.querySelector('[data-bar-index="3"]')!);

    expect(screen.getByTestId('trend-active-label')).toHaveTextContent('1300');
  });

  it('clears the active state when the pointer leaves the month label', () => {
    const data = makeData([
      ['2025-12', 1000],
      ['2026-01', 1100],
      ['2026-02', 1200],
      ['2026-03', 1300],
      ['2026-04', 1400],
      ['2026-05', 1568],
    ]);
    const { container } = render(<MonthlyTrendCard data={data} currency="EUR" />);
    const aprLabel = screen.getByTestId('month-label-4');

    fireEvent.mouseEnter(aprLabel);
    fireEvent.mouseLeave(aprLabel);

    const bar = container.querySelector<HTMLElement>('[data-bar-index="4"]')!;
    expect(bar.style.transform).toBe('');
  });
});
