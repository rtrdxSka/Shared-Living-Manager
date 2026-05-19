import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useBudgetInsights } from '@/hooks/queries/useBudgetQueries';
import { currentMonthString } from '@/utils/dashboardHelpers';

interface Props {
  householdId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  internet: 'Internet',
  groceries: 'Groceries',
  cleaning: 'Cleaning',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

export default function OverBudgetBanner({ householdId }: Props) {
  const month = currentMonthString();
  const { data } = useBudgetInsights(householdId, month);

  if (!data || data.overBudgetCategories.length === 0) return null;

  const list = data.overBudgetCategories.map((k) => CATEGORY_LABELS[k] ?? k).join(', ');
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>You're over budget this month</AlertTitle>
      <AlertDescription>
        Over: <strong>{list}</strong>.{' '}
        <Link to="/dashboard/budget" className="underline">
          View Budget →
        </Link>
      </AlertDescription>
    </Alert>
  );
}
