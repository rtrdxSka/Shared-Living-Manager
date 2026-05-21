import { Card, CardContent } from '@/components/ui/card';
import { useDashboard } from '@/contexts/useDashboard';
import {
  computeSettlement,
  type IncomeSplit,
  type SettlementMember,
  type SplitMethod,
} from '@/utils/settlementMatrix';
import type { ExpenseResponse } from '@/types/expense.types';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { MoneyAmount } from '@/components/ui/money-amount';

interface Props {
  expenses: ExpenseResponse[];
}

/**
 * Roommates settlement matrix. Computes a minimal set of "X owes Y N" rows
 * from the household's unresolved expenses. The current-user's rows are
 * emphasised so they spot what's actionable.
 *
 * Income data is sourced directly from each member's `monthlyIncome` — the
 * couple-shaped `incomeSplit` from context is `{myPct, partnerPct}` and
 * cannot represent N > 2 roommates.
 */
export function SettlementMatrixCard({ expenses }: Props) {
  const { household, currentUserId, currency, splitMethod } = useDashboard();

  const members: SettlementMember[] = household.members
    .filter((m) => m.userId && m.participatesInFinances)
    .map((m) => ({ userId: m.userId as string, nickname: m.nickname }));

  // Build income map directly from members; computeSettlement handles the
  // case where totals are zero (falls back to equal split).
  const incomeSplit: IncomeSplit | undefined =
    splitMethod === 'income_based'
      ? {
          byUserId: Object.fromEntries(
            household.members
              .filter((m) => m.userId && m.participatesInFinances)
              .map((m) => [m.userId as string, m.monthlyIncome ?? 0])
          ),
        }
      : undefined;

  const transactions = computeSettlement(
    members,
    expenses,
    splitMethod as SplitMethod,
    incomeSplit
  );

  const nameFor = (uid: string) =>
    members.find((m) => m.userId === uid)?.nickname ?? '?';

  const myDebts = transactions.filter((t) => t.from === currentUserId);
  const debtsToMe = transactions.filter((t) => t.to === currentUserId);
  const hasPersonalPosition = myDebts.length > 0 || debtsToMe.length > 0;

  return (
    <Card>
      <CardContent className="p-5">
        <EyebrowLabel as="div" className="mb-2">
          SETTLEMENT
        </EyebrowLabel>
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-3">All settled up.</p>
        ) : (
          <>
            {hasPersonalPosition && (
              <div
                className="mb-3 space-y-1.5 text-sm"
                data-testid="settlement-your-position"
              >
                <EyebrowLabel as="div" className="mb-1">
                  YOUR POSITION
                </EyebrowLabel>
                {myDebts.map((t, i) => (
                  <div
                    key={`me-owe-${t.to}-${i}`}
                    className="flex items-center justify-between gap-2 text-ink font-medium"
                  >
                    <span className="truncate">You owe {nameFor(t.to)}</span>
                    <MoneyAmount amount={t.amount} currency={currency} size="sm" />
                  </div>
                ))}
                {debtsToMe.map((t, i) => (
                  <div
                    key={`owe-me-${t.from}-${i}`}
                    className="flex items-center justify-between gap-2 text-ink font-medium"
                  >
                    <span className="truncate">{nameFor(t.from)} owes you</span>
                    <MoneyAmount amount={t.amount} currency={currency} size="sm" />
                  </div>
                ))}
              </div>
            )}
            {hasPersonalPosition && (
              <EyebrowLabel as="div" className="mb-1.5 mt-2">
                ALL DEBTS
              </EyebrowLabel>
            )}
            <ul className="space-y-1.5 text-sm">
              {transactions.map((t, i) => {
                const isMine = t.from === currentUserId || t.to === currentUserId;
                return (
                  <li
                    key={`${t.from}-${t.to}-${i}`}
                    className={`flex items-center justify-between gap-2 ${
                      isMine ? 'text-ink font-medium' : 'text-ink-2'
                    }`}
                  >
                    <span className="truncate">
                      {nameFor(t.from)} owes {nameFor(t.to)}
                    </span>
                    <MoneyAmount amount={t.amount} currency={currency} size="sm" />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
