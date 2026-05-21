import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpendingBreakdownCard from '@/components/dashboard/shared/SpendingBreakdownCard';
import type { BudgetInsights, BudgetInsightsByMemberEntry } from '@/types/budget.types';

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
    byMember: [],
    requestedScope: 'personal',
    effectiveScope: 'personal',
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

  it('highlights the matching donut segment when a legend row is hovered', () => {
    const { container } = render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);
    const groceriesRow = screen.getByTestId('legend-row-groceries');

    fireEvent.mouseEnter(groceriesRow);

    const dimmedRent = container.querySelector('circle[data-segment-id="rent"]') as SVGCircleElement;
    const activeGroceries = container.querySelector('circle[data-segment-id="groceries"]') as SVGCircleElement;
    expect(dimmedRent.style.opacity).toBe('0.3');
    expect(activeGroceries.style.opacity).toBe('1');
  });

  it('highlights the matching legend row when a donut segment is hovered', () => {
    const { container } = render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);
    const utilitiesSeg = container.querySelector('circle[data-segment-id="utilities"]') as SVGCircleElement;

    fireEvent.mouseEnter(utilitiesSeg);

    const utilitiesRow = screen.getByTestId('legend-row-utilities');
    expect(utilitiesRow.className).toMatch(/bg-surface-2/);
  });

  it('clears the active state when the pointer leaves the legend row', () => {
    const { container } = render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);
    const groceriesRow = screen.getByTestId('legend-row-groceries');

    fireEvent.mouseEnter(groceriesRow);
    fireEvent.mouseLeave(groceriesRow);

    const rentSeg = container.querySelector('circle[data-segment-id="rent"]') as SVGCircleElement;
    expect(rentSeg.style.opacity).toBe('1');
  });

  it('mirrors mouse hover on focus for keyboard users', () => {
    const { container } = render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);
    const rentRow = screen.getByTestId('legend-row-rent') as HTMLButtonElement;

    // The row is now a <button>
    expect(rentRow.tagName).toBe('BUTTON');

    fireEvent.focus(rentRow);
    const groceriesSeg = container.querySelector('circle[data-segment-id="groceries"]') as SVGCircleElement;
    expect(groceriesSeg.style.opacity).toBe('0.3');

    fireEvent.blur(rentRow);
    expect(groceriesSeg.style.opacity).toBe('1');
  });

  describe('byMember toggle', () => {
    // Split-mode shape: totalShare drives the donut + legend. totalPaid is
    // also present (cash outlay), but should be ignored when share is set.
    const makeByMember = (): BudgetInsightsByMemberEntry[] => [
      {
        memberId: 'm1',
        nickname: 'Alice',
        totalShare: 1000,
        shareByCategory: { rent: 700, groceries: 300 },
        totalPaid: 1200,
        paidByCategory: { rent: 900, groceries: 300 },
      },
      {
        memberId: 'm2',
        nickname: 'Bob',
        totalShare: 700,
        shareByCategory: { rent: 500, utilities: 120, groceries: 80 },
        totalPaid: 500,
        paidByCategory: { rent: 300, utilities: 120, groceries: 80 },
      },
    ];

    // Joint-mode shape: totalShare is undefined; donut/legend fall back to totalPaid.
    const makeByMemberJoint = (): BudgetInsightsByMemberEntry[] => [
      {
        memberId: 'm1',
        nickname: 'Alice',
        totalShare: undefined,
        shareByCategory: undefined,
        totalPaid: 1200,
        paidByCategory: { rent: 900, groceries: 300 },
      },
      {
        memberId: 'm2',
        nickname: 'Bob',
        totalShare: undefined,
        shareByCategory: undefined,
        totalPaid: 500,
        paidByCategory: { rent: 300, utilities: 120, groceries: 80 },
      },
    ];

    it('does not render the toggle when byMember prop is omitted', () => {
      render(<SpendingBreakdownCard data={makeData()} currency="EUR" />);
      expect(screen.queryByTestId('breakdown-mode-toggle')).not.toBeInTheDocument();
    });

    it('does not render the toggle when byMember prop is an empty array', () => {
      render(
        <SpendingBreakdownCard data={makeData()} currency="EUR" byMember={[]} />,
      );
      expect(screen.queryByTestId('breakdown-mode-toggle')).not.toBeInTheDocument();
    });

    it('renders the toggle with both options when byMember has at least one entry', () => {
      render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );
      expect(screen.getByTestId('breakdown-mode-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('breakdown-mode-category')).toBeInTheDocument();
      expect(screen.getByTestId('breakdown-mode-member')).toBeInTheDocument();
    });

    it('starts in category mode by default', () => {
      render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );

      // Category legend rows visible
      expect(screen.getByTestId('legend-row-rent')).toBeInTheDocument();
      expect(screen.queryByTestId('legend-row-member-m1')).not.toBeInTheDocument();
    });

    it('swaps to member donut & legend when "By member" is clicked', () => {
      render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );

      fireEvent.click(screen.getByTestId('breakdown-mode-member'));

      // Member rows render with nickname labels
      expect(screen.getByTestId('legend-row-member-m1')).toHaveTextContent('Alice');
      expect(screen.getByTestId('legend-row-member-m2')).toHaveTextContent('Bob');

      // Category rows are gone
      expect(screen.queryByTestId('legend-row-rent')).not.toBeInTheDocument();
      expect(screen.queryByTestId('legend-row-groceries')).not.toBeInTheDocument();
    });

    it('returns to category view when "By category" is clicked again', () => {
      render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );

      fireEvent.click(screen.getByTestId('breakdown-mode-member'));
      expect(screen.getByTestId('legend-row-member-m1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('breakdown-mode-category'));
      expect(screen.getByTestId('legend-row-rent')).toBeInTheDocument();
      expect(screen.queryByTestId('legend-row-member-m1')).not.toBeInTheDocument();
    });

    it('renders one donut segment per member in member mode', () => {
      const { container } = render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );

      fireEvent.click(screen.getByTestId('breakdown-mode-member'));

      expect(container.querySelector('circle[data-segment-id="member-m1"]')).not.toBeNull();
      expect(container.querySelector('circle[data-segment-id="member-m2"]')).not.toBeNull();
      // Category segments should no longer be present
      expect(container.querySelector('circle[data-segment-id="rent"]')).toBeNull();
    });

    it('split mode: donut + legend use totalShare', () => {
      // Alice totalShare=1000 vs totalPaid=1200 — donut + legend should show the
      // share number, not the paid number.
      const { container } = render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );
      fireEvent.click(screen.getByTestId('breakdown-mode-member'));

      // Legend amount reflects totalShare (1000.00), not totalPaid (1200.00).
      const aliceRow = screen.getByTestId('legend-row-member-m1');
      expect(aliceRow).toHaveTextContent('1000.00');
      expect(aliceRow).not.toHaveTextContent('1200.00');

      // Donut segment encodes the value in strokeDasharray's first number
      // (proportional to value). Larger value → larger dash length. Verify
      // the segment exists and has a non-empty dasharray driven by share.
      const m1Seg = container.querySelector(
        'circle[data-segment-id="member-m1"]',
      ) as SVGCircleElement;
      expect(m1Seg).not.toBeNull();
      const [dashLengthStr] = (m1Seg.getAttribute('strokeDasharray') ??
        m1Seg.getAttribute('stroke-dasharray') ??
        '').split(' ');
      const dashLength = Number(dashLengthStr);
      // share total = 1000 + 700 = 1700; size=140, thickness=16
      // radius = 62, circumference ≈ 389.56; m1 fraction = 1000/1700
      const expectedShareDash = (1000 / 1700) * (2 * Math.PI * 62);
      expect(dashLength).toBeCloseTo(expectedShareDash, 1);
    });

    it('joint mode: donut + legend fall back to totalPaid when totalShare is undefined', () => {
      const { container } = render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMemberJoint()}
        />,
      );
      fireEvent.click(screen.getByTestId('breakdown-mode-member'));

      // Legend reflects totalPaid (1200.00).
      const aliceRow = screen.getByTestId('legend-row-member-m1');
      expect(aliceRow).toHaveTextContent('1200.00');

      const m1Seg = container.querySelector(
        'circle[data-segment-id="member-m1"]',
      ) as SVGCircleElement;
      expect(m1Seg).not.toBeNull();
      const [dashLengthStr] = (m1Seg.getAttribute('strokeDasharray') ??
        m1Seg.getAttribute('stroke-dasharray') ??
        '').split(' ');
      const dashLength = Number(dashLengthStr);
      // paid total = 1200 + 500 = 1700; m1 fraction = 1200/1700
      const expectedPaidDash = (1200 / 1700) * (2 * Math.PI * 62);
      expect(dashLength).toBeCloseTo(expectedPaidDash, 1);
    });

    it('category-mode legend ul has min-w-0 class to allow truncation', () => {
      const { container } = render(
        <SpendingBreakdownCard data={makeData()} currency="EUR" />,
      );
      // jsdom doesn't render layout; assert the class is present on the <ul>.
      const ul = container.querySelector('ul');
      expect(ul).not.toBeNull();
      expect(ul!.className).toMatch(/min-w-0/);
    });

    it('member-mode legend ul has min-w-0 class to allow truncation', () => {
      const { container } = render(
        <SpendingBreakdownCard
          data={makeData()}
          currency="EUR"
          byMember={makeByMember()}
        />,
      );
      fireEvent.click(screen.getByTestId('breakdown-mode-member'));
      const ul = container.querySelector('ul');
      expect(ul).not.toBeNull();
      expect(ul!.className).toMatch(/min-w-0/);
    });
  });
});
