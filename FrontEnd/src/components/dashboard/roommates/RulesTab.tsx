import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDashboard } from '@/contexts/useDashboard';
import {
  useArchiveRule,
  useHouseRules,
  useRestoreRule,
} from '@/hooks/queries/useHouseRuleQueries';
import { extractApiError } from '@/utils/extractApiError';

export function RulesTab() {
  const { household, currentUserId } = useDashboard();
  const role = household.members.find(
    (m) => m.userId?.toString() === currentUserId
  )?.role;
  const isAdmin = role === 'owner' || role === 'admin';

  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, error } = useHouseRules(household._id, {
    includeArchived: showArchived,
  });
  const archive = useArchiveRule(household._id);
  const restore = useRestoreRule(household._id);
  const [actionError, setActionError] = useState<{
    ruleId: string;
    msg: string;
  } | null>(null);

  async function handleArchive(ruleId: string) {
    setActionError(null);
    try {
      await archive.mutateAsync(ruleId);
    } catch (err) {
      setActionError({
        ruleId,
        msg: extractApiError(err, 'Failed to archive rule.'),
      });
    }
  }

  async function handleRestore(ruleId: string) {
    setActionError(null);
    try {
      await restore.mutateAsync(ruleId);
    } catch (err) {
      setActionError({
        ruleId,
        msg: extractApiError(err, 'Failed to restore rule.'),
      });
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">House rules</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {extractApiError(error, 'Failed to load house rules.')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-sm text-ink-3">Loading rules…</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-ink-3">
          No house rules yet. When a vote passes, the rule will appear here.
        </p>
      )}

      <div className="space-y-2">
        {items.map((rule) => {
          const isArchived = Boolean(rule.archivedAt);
          const cardError =
            actionError?.ruleId === rule._id ? actionError.msg : null;
          return (
            <Card
              key={rule._id}
              className={`p-4 ${isArchived ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium">{rule.title}</h3>
                    {isArchived && (
                      <Badge variant="secondary" className="text-xs">
                        archived
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{rule.text}</p>
                  <p className="text-xs text-ink-3 mt-2">
                    Passed {new Date(rule.passedAt).toLocaleDateString()}
                    {isArchived && rule.archivedAt && (
                      <>
                        {' · archived '}
                        {new Date(rule.archivedAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                {isAdmin &&
                  (isArchived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restore.isPending}
                      onClick={() => handleRestore(rule._id)}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={archive.isPending}
                      onClick={() => handleArchive(rule._id)}
                    >
                      Archive
                    </Button>
                  ))}
              </div>
              {cardError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription>{cardError}</AlertDescription>
                </Alert>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
