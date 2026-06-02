import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SavingsPlanCard from '@/components/dashboard/couple/SavingsPlanCard';
import type { SplitContext } from '@/utils/goalPlanner';
import type { GoalResponse } from '@/types/goal.types';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;
const isoDaysFromNow = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY).toISOString();
const EQUAL: SplitContext = { splitMethod: 'equal', incomeSplit: null, customMyPct: 50 };

function makeGoal(p: Partial<GoalResponse> = {}): GoalResponse {
  return {
    _id: p._id ?? 'g1',
    householdId: 'h1',
    name: p.name ?? 'Goal',
    targetAmount: p.targetAmount ?? 1000,
    currentAmount: p.currentAmount ?? 0,
    deadline: p.deadline,
    status: p.status ?? 'active',
    priority: p.priority ?? 'normal',
    createdByUserId: 'u1',
    contributions: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof SavingsPlanCard>> = {}) {
  const onBudgetCommit = props.onBudgetCommit ?? vi.fn();
  const utils = render(
    <SavingsPlanCard
      goals={props.goals ?? [makeGoal({ _id: 'g1', name: 'Japan', targetAmount: 600, deadline: isoDaysFromNow(181) })]}
      splitCtx={props.splitCtx ?? EQUAL}
      currency={props.currency ?? 'GBP'}
      myLabel={props.myLabel ?? 'You'}
      partnerLabel={props.partnerLabel ?? 'Sam'}
      budget={props.budget ?? 0}
      onBudgetCommit={onBudgetCommit}
      incomeIncomplete={props.incomeIncomplete ?? false}
      now={props.now ?? NOW}
    />,
  );
  return { ...utils, onBudgetCommit };
}

describe('<SavingsPlanCard />', () => {
  it('shows an empty hint when there are no plannable goals', () => {
    renderCard({ goals: [] });
    expect(screen.getByText(/No active goals to plan for yet/i)).toBeInTheDocument();
  });

  it('previews the allocation live as the budget is typed', () => {
    // One goal needing 100/mo (600 over 6 months).
    renderCard();
    fireEvent.change(screen.getByTestId('savings-budget-input'), { target: { value: '100' } });

    const row = screen.getByTestId('plan-row-g1');
    expect(within(row).getByText(/needs 100 GBP\/mo/)).toBeInTheDocument();
    expect(within(row).getByText(/plan sets aside 100 GBP/)).toBeInTheDocument();
    expect(within(row).getByText('On plan')).toBeInTheDocument();
    // Equal split of the 100 allocated.
    expect(within(row).getByText(/You 50 · Sam 50/)).toBeInTheDocument();
  });

  it('seeds the input and allocation from the persisted budget prop', () => {
    renderCard({ budget: 100 });
    expect(screen.getByTestId('savings-budget-input')).toHaveValue(100);
    const row = screen.getByTestId('plan-row-g1');
    expect(within(row).getByText(/plan sets aside 100 GBP/)).toBeInTheDocument();
  });

  it('reports a shortfall when the budget cannot cover requirements', () => {
    renderCard();
    fireEvent.change(screen.getByTestId('savings-budget-input'), { target: { value: '40' } });

    const row = screen.getByTestId('plan-row-g1');
    expect(within(row).getByText('Partly on plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-total-shortfall')).toHaveTextContent('60 GBP');
  });

  it('commits the budget on blur with the parsed value', () => {
    const { onBudgetCommit } = renderCard();
    const input = screen.getByTestId('savings-budget-input');
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.blur(input);
    expect(onBudgetCommit).toHaveBeenCalledWith(250);
  });

  it('notes the 50/50 fallback when income data is incomplete', () => {
    renderCard({ incomeIncomplete: true });
    expect(screen.getByTestId('plan-income-note')).toBeInTheDocument();
  });

  it('captions the funding order so priority is explained', () => {
    renderCard();
    expect(screen.getByTestId('plan-order-caption')).toHaveTextContent(
      /priority first, then soonest deadline/i,
    );
  });

  it('badges High and Low goals but leaves Normal unbadged', () => {
    renderCard({
      budget: 1000,
      goals: [
        makeGoal({ _id: 'hi', name: 'Wedding', targetAmount: 600, deadline: isoDaysFromNow(181), priority: 'high' }),
        makeGoal({ _id: 'mid', name: 'Sofa', targetAmount: 600, deadline: isoDaysFromNow(181), priority: 'normal' }),
        makeGoal({ _id: 'lo', name: 'Gadget', targetAmount: 600, deadline: isoDaysFromNow(181), priority: 'low' }),
      ],
    });
    expect(screen.getByTestId('plan-priority-hi')).toHaveTextContent('High');
    expect(screen.getByTestId('plan-priority-lo')).toHaveTextContent('Low');
    expect(screen.queryByTestId('plan-priority-mid')).toBeNull();
  });
});
