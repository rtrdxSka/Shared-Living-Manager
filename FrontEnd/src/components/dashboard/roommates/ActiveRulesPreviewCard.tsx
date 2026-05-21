import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { useDashboard } from '@/contexts/useDashboard';
import { useHouseRules } from '@/hooks/queries/useHouseRuleQueries';

/**
 * Preview card showing the three most-recent active house rules. Backend
 * already excludes archived rules unless `includeArchived: true` is passed.
 */
export function ActiveRulesPreviewCard() {
  const { household } = useDashboard();
  const { data } = useHouseRules(household._id, {});
  const top = (data?.items ?? []).slice(0, 3);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <EyebrowLabel as="div">HOUSE RULES</EyebrowLabel>
          <Link
            to="/dashboard/house-rules"
            className="text-xs font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-ink-3">No rules agreed yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {top.map((r) => (
              <li
                key={r._id}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate text-ink">{r.title}</span>
                <span className="text-[11px] text-ink-3 shrink-0">
                  {new Date(r.passedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
