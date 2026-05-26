import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SparkBars } from '@/components/ui/spark-bars';
import { MoneyAmount } from '@/components/ui/money-amount';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMonthLabel } from '@/utils/dashboardHelpers';
import type { BudgetInsights } from '@/types/budget.types';

interface MonthlyTrendCardProps {
  data: BudgetInsights;
  currency: string;
}

const BAR_WIDTH = 20;
const BAR_GAP = 8;

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function shortMonthYear(ym: string): string {
  const [y] = ym.split('-');
  return `${shortMonth(ym)} ${y}`; // e.g. "Apr 2026"
}

interface DeltaDisplay {
  text: string;
  tone: 'pos' | 'neg' | 'neutral';
}

function computeDelta(current: number, prior: number, priorLabel: string): DeltaDisplay | null {
  if (prior === 0 && current === 0) return null;
  if (prior === 0 && current > 0) {
    return { text: 'new this month', tone: 'neutral' };
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { text: `0% vs ${priorLabel}`, tone: 'neutral' };
  const sign = pct > 0 ? '+' : '−';
  return {
    text: `${sign}${Math.abs(pct)}% vs ${priorLabel}`,
    tone: pct > 0 ? 'neg' : 'pos',
  };
}

export default function MonthlyTrendCard({ data, currency }: MonthlyTrendCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const trend = data.monthlyTrend;
  const trendValues = trend.map((p) => p.totalSpent);
  const hasAnySpend = trendValues.some((v) => v > 0);

  if (trend.length === 0 || !hasAnySpend) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last 6 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-3">No trend data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const avg = trendValues.reduce((s, v) => s + v, 0) / trendValues.length;
  const current = trend[trend.length - 1];
  const prior = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = prior ? computeDelta(current.totalSpent, prior.totalSpent, shortMonth(prior.monthString)) : null;

  // Footer: at rest, list every month that has spend; on hover/focus collapse to
  // the single inspected month. The chart already drives `activeIndex`.
  const monthsWithSpend = trend.filter((p) => p.totalSpent > 0);
  const activePoint = activeIndex != null ? trend[activeIndex] : null;

  const toneClass =
    delta?.tone === 'neg' ? 'text-neg' : delta?.tone === 'pos' ? 'text-pos' : 'text-ink-3';

  return (
    <Card className="interactive-strong">
      <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0">
        <CardTitle>Last 6 Months</CardTitle>
        <div className="flex items-baseline gap-2 text-xs">
          <span className="text-ink-3">Avg</span>
          <MoneyAmount amount={avg} currency={currency} size="sm" decimals={0} />
          {delta && (
            <>
              <span className="text-ink-3">•</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={toneClass} data-testid="mom-delta" tabIndex={0}>
                    {delta.text}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Change vs. the previous month. Negative means you spent less.
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-2"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <SparkBars
          values={trendValues}
          highlightLast
          height={48}
          barWidth={BAR_WIDTH}
          gap={BAR_GAP}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          valueLabel={(_, value) => (
            <span
              data-testid="trend-active-label"
              className="rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[10px] font-mono text-ink num"
            >
              {value.toFixed(0)}
            </span>
          )}
        />
        <div className="inline-flex" style={{ gap: BAR_GAP }}>
          {trend.map((p, i) => (
            <button
              type="button"
              key={`${p.monthString}-${i}`}
              style={{ width: BAR_WIDTH }}
              className="text-[10px] font-mono text-ink-3 text-center uppercase tracking-[0.1em] rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              data-testid={`month-label-${i}`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
            >
              {shortMonth(p.monthString)}
            </button>
          ))}
        </div>
        <div
          className="text-xs text-ink-3 pt-2 border-t border-line mt-1"
          data-testid="trend-footer"
        >
          {activePoint ? (
            <>
              <span className="text-ink">{formatMonthLabel(activePoint.monthString)}</span>:{' '}
              <MoneyAmount amount={activePoint.totalSpent} currency={currency} size="sm" />
            </>
          ) : (
            // Stack months vertically (up to 3 rows), then spill into a second
            // column once the rows fill up.
            <div className="grid grid-flow-col grid-rows-[repeat(3,auto)] justify-start gap-x-4 gap-y-1">
              {monthsWithSpend.map((p) => (
                <span key={p.monthString} className="inline-flex items-baseline gap-1.5">
                  <span className="text-ink">{shortMonthYear(p.monthString)}</span>
                  <MoneyAmount amount={p.totalSpent} currency={currency} size="sm" />
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
