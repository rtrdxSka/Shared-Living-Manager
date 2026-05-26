import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { useDashboard } from '@/contexts/useDashboard';
import { useIssues } from '@/hooks/queries/useIssueQueries';
import type { ExpenseResponse } from '@/types/expense.types';

import { ActiveRulesPreviewCard } from './ActiveRulesPreviewCard';
import { OpenVotesPreviewCard } from './OpenVotesPreviewCard';
import { SettlementMatrixCard } from './SettlementMatrixCard';

interface Props {
  expenses: ExpenseResponse[];
}

/**
 * Roommates overview stats grid. Composes the four key roommate signals:
 * settlement matrix, open issues count, open votes preview, active rules.
 */
export function RoommatesStatsRow({ expenses }: Props) {
  const { household, financeMode } = useDashboard();
  const { data: issues } = useIssues(household._id, { status: 'open' });
  const openIssueCount = issues?.items.length ?? 0;
  const showSettlement = financeMode === 'split';

  return (
    <div
      className={
        showSettlement
          ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
          : 'grid grid-cols-1 gap-4'
      }
    >
      {showSettlement && <SettlementMatrixCard expenses={expenses} />}

      <Card>
        <CardContent className="p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <EyebrowLabel as="div" className="mb-2">
              OPEN ISSUES
            </EyebrowLabel>
            <p className="text-sm text-ink-3">
              Raise or escalate roommate concerns.
            </p>
          </div>
          <Link
            to="/dashboard/house-rules"
            className="shrink-0"
            aria-label={`View ${openIssueCount} open issues`}
          >
            <Badge
              variant={openIssueCount > 0 ? 'default' : 'secondary'}
              className="text-base px-3 py-1 num"
            >
              {openIssueCount}
            </Badge>
          </Link>
        </CardContent>
      </Card>

      <OpenVotesPreviewCard />

      <ActiveRulesPreviewCard />
    </div>
  );
}
