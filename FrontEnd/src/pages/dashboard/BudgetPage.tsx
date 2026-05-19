import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useDashboard } from '@/contexts/DashboardContext';
import { useBudgetInsights, useUpdateBudget } from '@/hooks/queries/useBudgetQueries';
import { useAuth } from '@/hooks/useAuth';
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
import CategoryBudgetRow from '@/components/dashboard/solo/CategoryBudgetRow';
import SpendingBreakdownCard from '@/components/dashboard/solo/SpendingBreakdownCard';
import MonthlyTrendCard from '@/components/dashboard/solo/MonthlyTrendCard';
import IncomeManagementCard from '@/components/dashboard/shared/IncomeManagementCard';

import { BUDGET_CATEGORIES } from '@/types/budget.types';
import type { BudgetCategories } from '@/types/budget.types';
import { CATEGORY_LABELS } from '@/utils/categoryDisplay';

export default function BudgetPage() {
  const { household, currentUserId, currency } = useDashboard();
  const { user } = useAuth();
  const householdId = household._id;
  const myMember = household.members.find((m) => m.userId === user?._id);
  const isAdmin = myMember?.role === 'admin' || myMember?.role === 'owner';

  const [month, setMonth] = useState<string>(currentMonthString());
  const insightsQuery = useBudgetInsights(householdId, month);
  const updateBudget = useUpdateBudget(householdId);

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
      {/* Header + month picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budget</h1>
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

      {/* Action error alert */}
      {updateBudget.isError && (
        <Alert variant="destructive" data-testid="budget-action-error">
          <AlertDescription>
            {extractApiError(updateBudget.error, 'Failed to update budget. Please try again.')}
          </AlertDescription>
        </Alert>
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
          {BUDGET_CATEGORIES.map((cat) => (
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
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpendingBreakdownCard data={data} currency={currency} />
        <MonthlyTrendCard data={data} currency={currency} />
      </div>
    </div>
  );
}
