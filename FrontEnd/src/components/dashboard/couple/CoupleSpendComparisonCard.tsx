import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyAmount } from '@/components/ui/money-amount';
import type { BudgetInsightsByMemberEntry } from '@/types/budget.types';

interface Props {
  byMember: BudgetInsightsByMemberEntry[];
  myMemberId: string;
  partnerMemberId: string;
  /**
   * Which per-member metric drives the bars + delta footer.
   * - 'share': uses `totalShare` (split-mode households). A muted sub-line
   *   below the footer surfaces the paid totals for context.
   * - 'paid': uses `totalPaid` (joint-mode households). No sub-line, since
   *   there's nothing meaningful to compare it against in joint mode.
   */
  mode: 'share' | 'paid';
  currency?: string;
}

export default function CoupleSpendComparisonCard({
  byMember,
  myMemberId,
  partnerMemberId,
  mode,
  currency,
}: Props) {
  const me = byMember.find((m) => m.memberId === myMemberId);
  const partner = byMember.find((m) => m.memberId === partnerMemberId);

  // Defensive: if either is missing, render nothing.
  if (!me || !partner) {
    return null;
  }

  // Pick the metric driving the bars + footer based on mode.
  let meTotal: number;
  let partnerTotal: number;
  if (mode === 'share') {
    // Defensive: BudgetPage should only render this card in share mode when
    // both members have a defined totalShare. If they don't, treat it as
    // misconfigured and bail out rather than silently falling back.
    if (me.totalShare === undefined || partner.totalShare === undefined) {
      return null;
    }
    meTotal = me.totalShare;
    partnerTotal = partner.totalShare;
  } else {
    meTotal = me.totalPaid;
    partnerTotal = partner.totalPaid;
  }

  const max = Math.max(meTotal, partnerTotal);
  // Equal (including both-zero) → both bars at 100%; otherwise normalise.
  const myPct = max === 0 ? 100 : (meTotal / max) * 100;
  const partnerPct = max === 0 ? 100 : (partnerTotal / max) * 100;

  const delta = Math.abs(meTotal - partnerTotal);
  // Treat amounts within a small epsilon as equal — totals are JS float
  // sums, so values like 0.1 + 0.2 can drift. 0.005 covers half-cent
  // rounding at 2-decimal display precision.
  const isEqual = delta < 0.005;

  const verb = mode === 'share' ? 'spent' : 'paid';

  let footer: ReactNode;
  if (isEqual) {
    footer = "You're even";
  } else if (meTotal > partnerTotal) {
    footer = (
      <>
        You {verb}{' '}
        <MoneyAmount amount={delta} currency={currency} size="sm" /> more this
        month
      </>
    );
  } else {
    footer = (
      <>
        {partner.nickname} {verb}{' '}
        <MoneyAmount amount={delta} currency={currency} size="sm" /> more this
        month
      </>
    );
  }

  const title = mode === 'paid' ? 'Payment Activity' : 'Spending Comparison';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1" data-testid="comparison-row-me">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{me.nickname}</span>
              <MoneyAmount
                amount={meTotal}
                currency={currency}
                size="sm"
                className="shrink-0"
              />
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${myPct}%` }}
                data-testid="comparison-bar-me"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1" data-testid="comparison-row-partner">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{partner.nickname}</span>
              <MoneyAmount
                amount={partnerTotal}
                currency={currency}
                size="sm"
                className="shrink-0"
              />
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{ width: `${partnerPct}%` }}
                data-testid="comparison-bar-partner"
              />
            </div>
          </div>
        </div>
        <p
          className="text-xs text-ink-3 pt-3 border-t border-line"
          data-testid="comparison-footer"
        >
          {footer}
        </p>
        {mode === 'share' && (
          <p
            className="text-[10px] text-ink-3/80 -mt-2"
            data-testid="comparison-paid-subline"
          >
            paid: {me.nickname}{' '}
            <MoneyAmount amount={me.totalPaid} currency={currency} size="sm" />
            {' · '}
            {partner.nickname}{' '}
            <MoneyAmount
              amount={partner.totalPaid}
              currency={currency}
              size="sm"
            />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
