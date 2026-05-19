import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Donut } from '@/components/ui/donut';
import { MoneyAmount } from '@/components/ui/money-amount';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/utils/categoryDisplay';
import { BUDGET_CATEGORIES } from '@/types/budget.types';
import type { BudgetInsights } from '@/types/budget.types';
import type { ExpenseType } from '@/types/onboarding.types';

interface SpendingBreakdownCardProps {
  data: BudgetInsights;
  currency: string;
}

interface LegendEntry {
  cat: ExpenseType;
  value: number;
  pct: number;
}

export default function SpendingBreakdownCard({ data, currency }: SpendingBreakdownCardProps) {
  const entries: LegendEntry[] = BUDGET_CATEGORIES
    .map((cat) => ({ cat, value: data.spendByCategory[cat] ?? 0 }))
    .filter((e) => e.value > 0)
    .map((e) => ({
      ...e,
      pct: data.totalSpent > 0 ? Math.round((e.value / data.totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-3">No spending this month.</p>
        </CardContent>
      </Card>
    );
  }

  const segments = entries.map((e) => ({
    value: e.value,
    color: CATEGORY_COLORS[e.cat],
  }));
  const top = entries[0];
  const overBudget = data.overBudgetCategories;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
          <Donut
            size={140}
            segments={segments}
            centerLabel={data.totalSpent.toFixed(0)}
            centerSubLabel={<span className="uppercase tracking-[0.14em]">spent</span>}
          />
          <ul className="flex flex-col gap-1.5 w-full md:flex-1">
            {entries.map((e) => (
              <li
                key={e.cat}
                className="flex items-center justify-between gap-3 text-sm"
                data-testid={`legend-row-${e.cat}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CATEGORY_COLORS[e.cat] }}
                    aria-hidden
                  />
                  <span className="truncate">{CATEGORY_LABELS[e.cat]}</span>
                </span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <MoneyAmount amount={e.value} currency={currency} size="sm" />
                  <span className="text-ink-3 text-xs num">{e.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 pt-3 border-t border-line">
          <p className="text-xs text-ink-3" data-testid="top-callout">
            Top: <span className="text-ink font-medium">{CATEGORY_LABELS[top.cat]}</span> ({top.pct}%)
          </p>
          {overBudget.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="over-budget-chips">
              <span className="text-xs text-ink-3">Over budget:</span>
              {overBudget.map((cat) => (
                <span
                  key={cat}
                  className="rounded-md bg-neg/10 text-neg text-xs px-2 py-0.5"
                  data-testid={`over-chip-${cat}`}
                >
                  {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
