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
import type { BudgetCategories, BudgetInsightsScope } from '@/types/budget.types';
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
  } = useDashboard();
  const householdId = household._id;
  const isAdmin = myMember?.role === 'admin' || myMember?.role === 'owner';

  const [month, setMonth] = useState<string>(currentMonthString());
  // Joint-mode households can't meaningfully show per-user share, so the
  // toggle is forced to 'household' and disabled. In split mode default to
  // 'personal' (the user's share) — matches what people expect when they
  // see numbers like "you spent X this month".
  const isJointMode = financeMode === 'joint';
  const [scope, setScope] = useState<BudgetInsightsScope>(
    isJointMode ? 'household' : 'personal'
  );
  const effectiveRequestScope: BudgetInsightsScope = isJointMode ? 'household' : scope;
  const insightsQuery = useBudgetInsights(householdId, month, effectiveRequestScope);
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

  const handleSave = (next: BudgetCategories) => {
    updateBudget.mutate({ categories: next });
  };

  const isCurrentOrFuture = month >= currentMonthString();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header + month picker + scope toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="flex items-center gap-3">
          {/* YOU / HOUSEHOLD scope toggle */}
          <div
            className="flex items-center rounded-full border border-line bg-surface-2 p-0.5"
            data-testid="budget-scope-toggle"
          >
            <button
              type="button"
              onClick={() => !isJointMode && setScope('personal')}
              disabled={isJointMode}
              aria-pressed={effectiveRequestScope === 'personal'}
              data-testid="budget-scope-personal"
              title={isJointMode ? 'Joint mode shows shared household spending only' : undefined}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                effectiveRequestScope === 'personal'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-3 hover:text-ink',
                isJointMode && 'opacity-40 cursor-not-allowed hover:text-ink-3'
              )}
            >
              YOU
            </button>
            <button
              type="button"
              onClick={() => setScope('household')}
              aria-pressed={effectiveRequestScope === 'household'}
              data-testid="budget-scope-household"
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                effectiveRequestScope === 'household'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-3 hover:text-ink'
              )}
            >
              HOUSEHOLD
            </button>
          </div>
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

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Spent</CardTitle>
          </CardHeader>
          <CardContent data-testid="budget-total-spent">
            <MoneyAmount amount={data.totalSpent} currency={currency} />
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
                    data.totalSpent > data.totalBudgeted ? 'h-full bg-neg' : 'h-full bg-accent'
                  }
                  style={{
                    width: `${Math.min(100, (data.totalSpent / data.totalBudgeted) * 100)}%`,
                  }}
                />
              </div>
            )}
            {data.effectiveScope === 'personal' && (
              <p className="mt-1.5 text-[11px] text-ink-3">
                Household budget · your share of spending shown
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Savings Rate</CardTitle>
          </CardHeader>
          <CardContent data-testid="budget-savings-rate">
            {data.savingsRate === null ? (
              <span className="text-ink-3 text-sm">
                Set income below to see your savings rate
              </span>
            ) : (
              `${(data.savingsRate * 100).toFixed(0)}%`
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income management — solo users can set monthly income for savings rate */}
      <IncomeManagementCard
        household={household}
        currentUserId={currentUserId}
        currency={currency}
      />

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
