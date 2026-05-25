import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useDashboard } from '@/contexts/useDashboard';
import { useBudgetInsights, useUpdateBudget } from '@/hooks/queries/useBudgetQueries';
import {
  currentMonthString,
  stepMonth,
  formatMonthLabel,
} from '@/utils/dashboardHelpers';
import { extractApiError } from '@/utils/extractApiError';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MoneyAmount } from '@/components/ui/money-amount';
import CategoryBudgetRow from '@/components/dashboard/shared/CategoryBudgetRow';
import SpendingBreakdownCard from '@/components/dashboard/shared/SpendingBreakdownCard';
import MonthlyTrendCard from '@/components/dashboard/shared/MonthlyTrendCard';
import IncomeManagementCard from '@/components/dashboard/shared/IncomeManagementCard';
import CoupleSpendComparisonCard from '@/components/dashboard/couple/CoupleSpendComparisonCard';

import { BUDGET_CATEGORIES } from '@/types/budget.types';
import type { BudgetCategories } from '@/types/budget.types';
import type { ExpenseType } from '@/types/onboarding.types';
import { CATEGORY_LABELS } from '@/utils/categoryDisplay';
import { cn } from '@/lib/utils';

export default function BudgetPage() {
  const {
    household,
    currentUserId,
    currency,
    uiMode,
    myMember,
    partnerMember,
    myNickname,
    partnerNickname,
    financeMode,
    splitMethod,
  } = useDashboard();
  const householdId = household._id;
  const isAdmin = myMember?.role === 'admin' || myMember?.role === 'owner';

  const [month, setMonth] = useState<string>(currentMonthString());

  // The whole page operates at household scope: setting budget caps is a
  // household activity, and a personal/household toggle inevitably mixes scopes
  // in the summary row (your spend next to the household cap). So the summary is
  // always the household picture; the per-person dimension lives in the couple
  // comparison card, where each figure is clearly attributed to a person.
  const isRoommates = uiMode === 'roommates';

  const insightsQuery = useBudgetInsights(householdId, month, 'household');
  const updateBudget = useUpdateBudget(householdId);

  // Couple-mode is only active when both members are present in the dashboard
  // context. Defensive coercion of _id to string in case it arrives as an
  // ObjectId-like object on some code paths.
  const isCoupleView =
    uiMode === 'couple' && myMember != null && partnerMember != null;
  const myMemberIdStr = myMember ? String(myMember._id) : '';
  const partnerMemberIdStr = partnerMember ? String(partnerMember._id) : '';

  // Build a map of category → { share?, paid } from the per-member breakdown
  // so each CategoryBudgetRow can render both sub-blocks inline. Only
  // computed when in couple view; otherwise the map is empty and rows render
  // unchanged (no byMemberSplit prop). Computed unconditionally to keep hook
  // order stable across the loading/error early-return branches.
  const byMemberData = insightsQuery.data?.byMember;
  const byCategoryMap = useMemo(() => {
    type ByMemberSplitForCategory = {
      share?: { myAmount: number; partnerAmount: number };
      paid: { myAmount: number; partnerAmount: number };
    };
    const map = new Map<ExpenseType, ByMemberSplitForCategory>();
    if (!isCoupleView || !byMemberData) return map;
    const me = byMemberData.find((m) => m.memberId === myMemberIdStr);
    const partner = byMemberData.find((m) => m.memberId === partnerMemberIdStr);
    if (!me || !partner) return map;
    for (const cat of BUDGET_CATEGORIES) {
      const myShare = me.shareByCategory?.[cat];
      const partnerShare = partner.shareByCategory?.[cat];
      const myPaid = me.paidByCategory[cat] ?? 0;
      const partnerPaid = partner.paidByCategory[cat] ?? 0;

      // Skip categories with no activity at all.
      const hasShare = (myShare ?? 0) > 0 || (partnerShare ?? 0) > 0;
      const hasPaid = myPaid > 0 || partnerPaid > 0;
      if (!hasShare && !hasPaid) continue;

      // `share` is omitted when neither member has a share entry (joint mode
      // or no expense activity at the share level). Both `me` and `partner`
      // will have shareByCategory either both defined or both undefined,
      // because the backend treats joint mode uniformly.
      const share =
        me.shareByCategory !== undefined && partner.shareByCategory !== undefined
          ? { myAmount: myShare ?? 0, partnerAmount: partnerShare ?? 0 }
          : undefined;

      map.set(cat, {
        share,
        paid: { myAmount: myPaid, partnerAmount: partnerPaid },
      });
    }
    return map;
  }, [isCoupleView, byMemberData, myMemberIdStr, partnerMemberIdStr]);

  if (insightsQuery.isLoading) {
    return <div className="p-6">Loading budget…</div>;
  }
  if (!insightsQuery.data) {
    return <div className="p-6">Could not load budget.</div>;
  }
  const data = insightsQuery.data;

  // ── Household budget summary ──────────────────────────────────────────
  // The whole summary row is budget-scoped: spend vs cap vs remaining.
  // `myByMember` is still needed for the roommate per-category "your share"
  // subline.
  const myByMember = data.byMember.find((m) => m.memberId === myMemberIdStr);
  const householdSpent = data.totalSpent;

  // Budget status: how much of the cap is left, or how far over, plus % used.
  // An income-based savings rate deliberately does NOT live here — next to the
  // caps it reads as budget adherence, which it isn't. `pctUsed` is null when
  // nothing is budgeted.
  const hasBudget = data.totalBudgeted > 0;
  const budgetRemaining = data.totalBudgeted - householdSpent;
  const isOverBudget = budgetRemaining < 0;
  const pctUsed = hasBudget
    ? Math.round((householdSpent / data.totalBudgeted) * 100)
    : null;

  // The income card stays only where income actually drives the split
  // (income-based households). Equal/custom splits and solo don't need it on
  // this page; solo sets income on the Account page.
  const showIncomeCard =
    financeMode === 'split' && splitMethod === 'income_based';

  const handleSave = (next: BudgetCategories) => {
    updateBudget.mutate({ categories: next });
  };

  const isCurrentOrFuture = month >= currentMonthString();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header + month picker + scope toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Budget</h1>
          {isRoommates && (
            <p className="text-sm text-ink-3">Shared household spending</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMonth((m) => stepMonth(m, 'prev'))}
              aria-label="Previous month"
              data-testid="budget-month-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 min-w-[120px] text-center" data-testid="budget-month-label">
              {formatMonthLabel(month)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMonth((m) => stepMonth(m, 'next'))}
              disabled={month >= currentMonthString()}
              aria-label="Next month"
              data-testid="budget-month-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action error alert */}
      {updateBudget.isError && (
        <Alert variant="destructive" data-testid="budget-action-error">
          <AlertDescription>
            {extractApiError(updateBudget.error, 'Failed to update budget. Please try again.')}
          </AlertDescription>
        </Alert>
      )}

      {/* Couple-only: per-member spending comparison card above the summary row */}
      {isCoupleView && (
        <CoupleSpendComparisonCard
          byMember={data.byMember}
          myMemberId={myMemberIdStr}
          partnerMemberId={partnerMemberIdStr}
          currency={currency}
          mode={financeMode === 'joint' ? 'paid' : 'share'}
        />
      )}

      {/* Summary row — all three cards are the same budget scope */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Spent</CardTitle>
          </CardHeader>
          <CardContent data-testid="budget-total-spent">
            <MoneyAmount amount={householdSpent} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Budgeted</CardTitle>
          </CardHeader>
          <CardContent data-testid="budget-total-budgeted">
            <MoneyAmount amount={data.totalBudgeted} currency={currency} />
            {data.totalBudgeted > 0 && (
              <div className="h-2 bg-surface-2 rounded mt-2 overflow-hidden">
                <div
                  className={
                    householdSpent > data.totalBudgeted ? 'h-full bg-neg' : 'h-full bg-accent'
                  }
                  style={{
                    width: `${Math.min(100, (householdSpent / data.totalBudgeted) * 100)}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget Status</CardTitle>
          </CardHeader>
          <CardContent data-testid="budget-status">
            {!hasBudget ? (
              <span className="text-ink-3 text-sm">
                Set category budgets to track this
              </span>
            ) : (
              <>
                <MoneyAmount
                  amount={Math.abs(budgetRemaining)}
                  currency={currency}
                  tone={isOverBudget ? 'neg' : 'neutral'}
                />
                <p
                  className={cn(
                    'text-xs mt-1',
                    isOverBudget ? 'text-neg' : 'text-ink-3'
                  )}
                >
                  {isOverBudget ? 'over' : 'left'} · {pctUsed}% used
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income management — set monthly income for savings rate / income split */}
      {showIncomeCard && (
        <IncomeManagementCard
          household={household}
          currentUserId={currentUserId}
          currency={currency}
        />
      )}

      {/* Over-budget inline alert */}
      {data.overBudgetCategories.length > 0 && (
        <Alert variant="destructive" data-testid="budget-over-alert">
          <AlertDescription>
            Over budget: <strong>{data.overBudgetCategories.map((k) => CATEGORY_LABELS[k] ?? k).join(', ')}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Category list */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {BUDGET_CATEGORIES.map((cat) => {
            const split = byCategoryMap.get(cat);
            const myShareForCat = myByMember?.shareByCategory?.[cat];
            return (
              <CategoryBudgetRow
                key={cat}
                category={cat}
                label={CATEGORY_LABELS[cat]}
                budgeted={data.budget[cat]}
                spent={data.spendByCategory[cat] ?? 0}
                canEdit={isAdmin && isCurrentOrFuture}
                isSaving={updateBudget.isPending}
                onSave={handleSave}
                currentCategories={data.budget}
                currency={currency}
                byMemberSplit={
                  split
                    ? {
                        myNickname,
                        partnerNickname,
                        share: split.share,
                        paid: split.paid,
                      }
                    : undefined
                }
                myShareLine={
                  isRoommates && typeof myShareForCat === 'number'
                    ? { amount: myShareForCat }
                    : undefined
                }
              />
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpendingBreakdownCard
          data={data}
          currency={currency}
          byMember={isCoupleView ? data.byMember : undefined}
        />
        <MonthlyTrendCard data={data} currency={currency} />
      </div>
    </div>
  );
}
