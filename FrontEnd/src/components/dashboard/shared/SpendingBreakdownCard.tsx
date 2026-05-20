import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Donut } from '@/components/ui/donut';
import { MoneyAmount } from '@/components/ui/money-amount';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/utils/categoryDisplay';
import { BUDGET_CATEGORIES } from '@/types/budget.types';
import type { BudgetInsights, BudgetInsightsByMemberEntry } from '@/types/budget.types';
import type { ExpenseType } from '@/types/onboarding.types';

interface SpendingBreakdownCardProps {
  data: BudgetInsights;
  currency: string;
  byMember?: BudgetInsightsByMemberEntry[];
}

interface LegendEntry {
  cat: ExpenseType;
  value: number;
  pct: number;
}

interface MemberLegendEntry {
  memberId: string;
  nickname: string;
  value: number;
  pct: number;
  color: string;
}

/** Palette for per-member donut slices — distinct from category colors. */
const MEMBER_PALETTE = [
  'hsl(var(--accent))',
  'hsl(var(--cat-other))',
  'hsl(var(--cat-rent))',
  'hsl(var(--pos))',
];

type BreakdownMode = 'category' | 'member';

export default function SpendingBreakdownCard({
  data,
  currency,
  byMember,
}: SpendingBreakdownCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<BreakdownMode>('category');

  const hasMemberData = Array.isArray(byMember) && byMember.length > 0;
  const effectiveMode: BreakdownMode = hasMemberData ? mode : 'category';

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

  const categorySegments = entries.map((e) => ({
    id: e.cat,
    value: e.value,
    color: CATEGORY_COLORS[e.cat],
  }));
  const top = entries[0];
  const overBudget = data.overBudgetCategories;

  // Build member-mode legend data (only when byMember is provided & non-empty).
  // Use totalShare when present (split mode); fall back to totalPaid (joint mode).
  const memberEntries: MemberLegendEntry[] = hasMemberData
    ? byMember!
        .map((m) => ({ m, value: m.totalShare ?? m.totalPaid }))
        .filter((e) => e.value > 0)
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(({ m, value }, i) => {
          const pct =
            data.totalSpent > 0
              ? Math.round((value / data.totalSpent) * 100)
              : 0;
          return {
            memberId: m.memberId,
            nickname: m.nickname,
            value,
            pct,
            color: MEMBER_PALETTE[i % MEMBER_PALETTE.length],
          };
        })
    : [];

  const memberSegments = memberEntries.map((m) => ({
    id: `member-${m.memberId}`,
    value: m.value,
    color: m.color,
  }));

  const handleSetMode = (next: BreakdownMode) => {
    if (next === effectiveMode) return;
    setMode(next);
    setActiveId(null);
  };

  return (
    <Card className="interactive-strong">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Spending Breakdown</CardTitle>
        {hasMemberData && (
          <div
            role="group"
            aria-label="Breakdown mode"
            data-testid="breakdown-mode-toggle"
            className="inline-flex items-center rounded-md bg-surface-2 p-0.5 text-xs"
          >
            <button
              type="button"
              data-testid="breakdown-mode-category"
              onClick={() => handleSetMode('category')}
              aria-pressed={effectiveMode === 'category'}
              className={cn(
                'rounded px-2 py-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
                effectiveMode === 'category'
                  ? 'bg-background text-ink shadow-sm'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              By category
            </button>
            <button
              type="button"
              data-testid="breakdown-mode-member"
              onClick={() => handleSetMode('member')}
              aria-pressed={effectiveMode === 'member'}
              className={cn(
                'rounded px-2 py-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
                effectiveMode === 'member'
                  ? 'bg-background text-ink shadow-sm'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              By member
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4">
          <Donut
            size={140}
            segments={effectiveMode === 'member' ? memberSegments : categorySegments}
            activeId={activeId}
            onActiveChange={(id) => setActiveId(id)}
            centerLabel={data.totalSpent.toFixed(0)}
            centerSubLabel={<span className="uppercase tracking-[0.14em]">spent</span>}
          />
          {effectiveMode === 'category' ? (
            <ul className="flex flex-col gap-1.5 w-full lg:flex-1 min-w-0">
              {entries.map((e) => {
                const isActive = activeId === e.cat;
                return (
                  <li key={e.cat} className="contents">
                    <button
                      type="button"
                      data-testid={`legend-row-${e.cat}`}
                      onMouseEnter={() => setActiveId(e.cat)}
                      onMouseLeave={() => setActiveId(null)}
                      onFocus={() => setActiveId(e.cat)}
                      onBlur={() => setActiveId(null)}
                      className={cn(
                        'flex items-center justify-between gap-3 text-sm w-full text-left rounded-md px-2 py-1 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
                        isActive && 'bg-surface-2'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                          style={{
                            background: CATEGORY_COLORS[e.cat],
                            transform: isActive ? 'scale(1.2)' : undefined,
                          }}
                          aria-hidden
                        />
                        <span className="truncate">{CATEGORY_LABELS[e.cat]}</span>
                      </span>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <MoneyAmount amount={e.value} currency={currency} size="sm" />
                        <span className="text-ink-3 text-xs num">{e.pct}%</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5 w-full lg:flex-1 min-w-0">
              {memberEntries.map((m) => {
                const segId = `member-${m.memberId}`;
                const isActive = activeId === segId;
                return (
                  <li key={m.memberId} className="contents">
                    <button
                      type="button"
                      data-testid={`legend-row-member-${m.memberId}`}
                      onMouseEnter={() => setActiveId(segId)}
                      onMouseLeave={() => setActiveId(null)}
                      onFocus={() => setActiveId(segId)}
                      onBlur={() => setActiveId(null)}
                      className={cn(
                        'flex items-center justify-between gap-3 text-sm w-full text-left rounded-md px-2 py-1 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
                        isActive && 'bg-surface-2'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                          style={{
                            background: m.color,
                            transform: isActive ? 'scale(1.2)' : undefined,
                          }}
                          aria-hidden
                        />
                        <span className="truncate">{m.nickname}</span>
                      </span>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <MoneyAmount amount={m.value} currency={currency} size="sm" />
                        <span className="text-ink-3 text-xs num">{m.pct}%</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
