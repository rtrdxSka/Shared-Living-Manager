import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CoupleSpendComparisonCard from '@/components/dashboard/couple/CoupleSpendComparisonCard';
import type { BudgetInsightsByMemberEntry } from '@/types/budget.types';

function makeByMember(
  me: Partial<BudgetInsightsByMemberEntry> = {},
  partner: Partial<BudgetInsightsByMemberEntry> = {},
): BudgetInsightsByMemberEntry[] {
  return [
    {
      memberId: 'me',
      nickname: 'Alice',
      // Distinct totalShare vs totalPaid so we can detect misuse.
      totalShare: 800,
      shareByCategory: {},
      totalPaid: 1200,
      paidByCategory: {},
      ...me,
    },
    {
      memberId: 'partner',
      nickname: 'Bob',
      totalShare: 500,
      shareByCategory: {},
      totalPaid: 0,
      paidByCategory: {},
      ...partner,
    },
  ];
}

describe('<CoupleSpendComparisonCard />', () => {
  it('renders both nicknames and totals', () => {
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember()}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // MoneyAmount renders e.g. "800.00" — share totals.
    expect(screen.getByText(/800\.00/)).toBeInTheDocument();
    expect(screen.getByText(/500\.00/)).toBeInTheDocument();
  });

  it('shows "You spent <delta> more this month" with formatted money when me > partner', () => {
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember(
          { totalShare: 800 },
          { totalShare: 500 },
        )}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    const footer = screen.getByTestId('comparison-footer');
    // Text spans multiple nodes (text + <MoneyAmount /> + text), so assert
    // on textContent and verify the delta is formatted via MoneyAmount.
    expect(footer.textContent).toMatch(/You spent\s*300\.00\s*more this month/);
  });

  it('shows "<partner> spent <delta> more this month" with formatted money when partner > me', () => {
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember(
          { totalShare: 200 },
          { totalShare: 750 },
        )}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    const footer = screen.getByTestId('comparison-footer');
    expect(footer.textContent).toMatch(/Bob spent\s*550\.00\s*more this month/);
  });

  it('shows "You\'re even" when totals are equal', () => {
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember(
          // Equal totalShare; distinct totalPaid (also verifies share mode
          // uses totalShare for the equality check, not totalPaid).
          { totalShare: 400, totalPaid: 900 },
          { totalShare: 400, totalPaid: 100 },
        )}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    expect(screen.getByText(/you're even/i)).toBeInTheDocument();
  });

  it('shows "You\'re even" when totals differ only by a floating-point drift below the epsilon', () => {
    // Simulate the kind of drift `0.1 + 0.2`-style sums produce in JS floats.
    const drift = Number.EPSILON * 5;
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember(
          { totalShare: 100.1 },
          { totalShare: 100.1 + drift },
        )}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    expect(screen.getByText(/you're even/i)).toBeInTheDocument();
  });

  it('sets the bar widths proportional to the larger total', () => {
    // me=200, partner=100 → me bar 100%, partner bar 50%.
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember(
          { totalShare: 200 },
          { totalShare: 100 },
        )}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    const meBar = screen.getByTestId('comparison-bar-me') as HTMLElement;
    const partnerBar = screen.getByTestId('comparison-bar-partner') as HTMLElement;

    expect(meBar.style.width).toBe('100%');
    expect(partnerBar.style.width).toBe('50%');
  });

  it('renders nothing when myMemberId is not in byMember', () => {
    const { container } = render(
      <CoupleSpendComparisonCard
        byMember={makeByMember()}
        myMemberId="missing"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when partnerMemberId is not in byMember', () => {
    const { container } = render(
      <CoupleSpendComparisonCard
        byMember={makeByMember()}
        myMemberId="me"
        partnerMemberId="missing"
        mode="share"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  describe("mode='share'", () => {
    it('renders share-driven bars and footer and a paid sub-line with paid totals', () => {
      render(
        <CoupleSpendComparisonCard
          byMember={makeByMember(
            { totalShare: 600, totalPaid: 1200 },
            { totalShare: 600, totalPaid: 0 },
          )}
          myMemberId="me"
          partnerMemberId="partner"
          mode="share"
        />,
      );

      // Title is "Spending Comparison".
      expect(screen.getByText('Spending Comparison')).toBeInTheDocument();

      // Bars are share-driven: both 600 → equal → both 100% wide.
      const meBar = screen.getByTestId('comparison-bar-me') as HTMLElement;
      const partnerBar = screen.getByTestId('comparison-bar-partner') as HTMLElement;
      expect(meBar.style.width).toBe('100%');
      expect(partnerBar.style.width).toBe('100%');

      // Footer reads from share totals → equal.
      expect(screen.getByText(/you're even/i)).toBeInTheDocument();

      // Paid sub-line is present and shows paid totals.
      const subline = screen.getByTestId('comparison-paid-subline');
      expect(subline).toBeInTheDocument();
      expect(subline.textContent).toMatch(/paid:/i);
      expect(subline.textContent).toMatch(/Alice/);
      expect(subline.textContent).toMatch(/1200\.00/);
      expect(subline.textContent).toMatch(/Bob/);
      expect(subline.textContent).toMatch(/0\.00/);
    });

    it('renders nothing when totalShare is undefined on a member (defensive guard)', () => {
      const { container } = render(
        <CoupleSpendComparisonCard
          byMember={makeByMember(
            { totalShare: undefined, totalPaid: 1200 },
            { totalShare: 600, totalPaid: 0 },
          )}
          myMemberId="me"
          partnerMemberId="partner"
          mode="share"
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("mode='paid'", () => {
    it('renders paid-driven bars and footer, retitles, and hides the sub-line', () => {
      render(
        <CoupleSpendComparisonCard
          byMember={makeByMember(
            { totalShare: 600, totalPaid: 1200 },
            { totalShare: 600, totalPaid: 0 },
          )}
          myMemberId="me"
          partnerMemberId="partner"
          mode="paid"
        />,
      );

      // Title becomes "Payment Activity".
      expect(screen.getByText('Payment Activity')).toBeInTheDocument();
      expect(screen.queryByText('Spending Comparison')).not.toBeInTheDocument();

      // Bars + footer use paid totals: me=1200, partner=0 → me bar 100%, partner bar 0%.
      const meBar = screen.getByTestId('comparison-bar-me') as HTMLElement;
      const partnerBar = screen.getByTestId('comparison-bar-partner') as HTMLElement;
      expect(meBar.style.width).toBe('100%');
      expect(partnerBar.style.width).toBe('0%');

      // Footer reads paid totals — delta = 1200, with "paid" verb.
      const footer = screen.getByTestId('comparison-footer');
      expect(footer.textContent).toMatch(/You paid\s*1200\.00\s*more this month/);
      expect(footer.textContent).not.toMatch(/spent/);

      // No paid sub-line in paid mode.
      expect(screen.queryByTestId('comparison-paid-subline')).toBeNull();
    });
  });

  it('does not render any per-member savings line (income-based savings lives off the budget page)', () => {
    render(
      <CoupleSpendComparisonCard
        byMember={makeByMember({ totalShare: 800 }, { totalShare: 500 })}
        myMemberId="me"
        partnerMemberId="partner"
        mode="share"
      />,
    );

    expect(screen.queryByTestId('comparison-savings-me')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-savings-partner')).not.toBeInTheDocument();
  });
});
