import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { MoneyAmount } from '@/components/ui/money-amount';
import { useBudgetInsights } from '@/hooks/queries/useBudgetQueries';
import { currentMonthString } from '@/utils/dashboardHelpers';
import { CATEGORY_LABELS } from '@/utils/categoryDisplay';
import type { ExpenseType } from '@/types/onboarding.types';

interface Props {
  householdId: string;
  currency: string;
}

interface OverItem {
  cat: ExpenseType;
  spent: number;
  budget: number;
  over: number;
  pctOver: number;
  severe: boolean;
}

const SEVERE_THRESHOLD = 50; // % over budget at which we shift to the coral severe tone.

export default function OverBudgetBanner({ householdId, currency }: Props) {
  const month = currentMonthString();
  // Banner reflects the household-wide over-budget state; `overBudgetCategories`
  // is derived from household totals regardless of scope, so request household
  // scope here to keep `spendByCategory` and `budget` in the same dimension.
  const { data } = useBudgetInsights(householdId, month, 'household');

  if (!data || data.overBudgetCategories.length === 0) return null;

  const items: OverItem[] = data.overBudgetCategories
    .map((cat): OverItem => {
      const spent = data.spendByCategory[cat] ?? 0;
      const budget = data.budget[cat] ?? 0;
      const over = spent - budget;
      const pctOver = budget > 0 ? (over / budget) * 100 : 0;
      return { cat, spent, budget, over, pctOver, severe: pctOver >= SEVERE_THRESHOLD };
    })
    .sort((a, b) => b.over - a.over);

  const totalOver = items.reduce((s, i) => s + i.over, 0);

  return (
    <div
      className="rounded-2xl border border-warn/40 bg-warn-bg/60 p-5 mb-4 interactive-strong"
      data-testid="over-budget-banner"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warn/20">
          <AlertTriangle className="h-5 w-5 text-warn" />
        </div>
        <div className="flex-1 min-w-0">
          <EyebrowLabel className="text-warn mb-1">OVER BUDGET</EyebrowLabel>
          <p className="text-base text-ink leading-snug">
            You&apos;re{' '}
            <span className="font-serif italic font-semibold text-warn" data-testid="over-budget-hero">
              <MoneyAmount amount={totalOver} currency={currency} decimals={0} size="md" />
            </span>{' '}
            over this month
          </p>
          <p className="text-xs text-ink-3 mt-0.5">
            across {items.length} {items.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((it) => {
          return (
            <li
              key={it.cat}
              className="flex items-center gap-3 text-sm"
              data-testid={`over-item-${it.cat}`}
            >
              <span className="w-24 truncate text-ink-2 shrink-0">
                {CATEGORY_LABELS[it.cat] ?? it.cat}
              </span>
              {/* The banner only lists over-budget categories, so every bar is
                  100% full by definition — magnitude lives in the +delta number.
                  Colour signals severity: deep red past the 50% threshold,
                  amber for a mild overspend. */}
              <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={cn('h-full w-full', it.severe ? 'bg-neg' : 'bg-warn')}
                  data-testid={`over-bar-${it.cat}`}
                />
              </div>
              <span className="text-ink-3 num text-xs w-28 text-right shrink-0">
                <MoneyAmount amount={it.spent} currency="" size="sm" decimals={0} />
                {' / '}
                <MoneyAmount amount={it.budget} currency="" size="sm" decimals={0} />
              </span>
              <span
                className={cn(
                  'w-16 text-right text-xs font-medium num shrink-0',
                  it.severe ? 'text-neg' : 'text-warn',
                )}
                data-testid={`over-delta-${it.cat}`}
              >
                +<MoneyAmount amount={it.over} currency="" size="sm" decimals={0} />
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex justify-end">
        <Link
          to="/dashboard/budget"
          className="text-xs font-medium text-warn hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 rounded"
        >
          View budget breakdown →
        </Link>
      </div>
    </div>
  );
}
