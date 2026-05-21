import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDashboard } from '@/contexts/useDashboard';
import {
  useIssues,
  useToggleUpvote,
} from '@/hooks/queries/useIssueQueries';
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  type IssueCategory,
  type IssueStatus,
} from '@/types/issue.types';
import { extractApiError } from '@/utils/extractApiError';

import { NewIssueSheet } from './NewIssueSheet';
import { IssueDetailDialog } from './IssueDetailDialog';

export function IssuesTab() {
  const { household } = useDashboard();
  const [statusFilter, setStatusFilter] = useState<IssueStatus>('open');
  const [categoryFilter, setCategoryFilter] =
    useState<IssueCategory | undefined>(undefined);

  const { data, isLoading, error } = useIssues(household._id, {
    status: statusFilter,
    category: categoryFilter,
  });
  const toggleUpvote = useToggleUpvote(household._id);

  const [composerOpen, setComposerOpen] = useState(false);
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {extractApiError(error, 'Failed to load issues.')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {ISSUE_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <Button
            size="sm"
            variant={categoryFilter ? 'outline' : 'default'}
            onClick={() => setCategoryFilter(undefined)}
          >
            all categories
          </Button>
          {ISSUE_CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={categoryFilter === c ? 'default' : 'outline'}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <Button onClick={() => setComposerOpen(true)}>New issue</Button>
      </div>

      {isLoading && (
        <p className="text-sm text-ink-3">Loading issues…</p>
      )}

      {!isLoading && data?.items.length === 0 && (
        <p className="text-sm text-ink-3">
          No issues. Be the first to raise one.
        </p>
      )}

      <div className="space-y-2">
        {data?.items.map((issue) => (
          <Card
            key={issue._id}
            role="button"
            tabIndex={0}
            className="p-4 cursor-pointer hover:bg-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            onClick={() => setDetailIssueId(issue._id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDetailIssueId(issue._id);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-medium">{issue.title}</h3>
                  <Badge variant="outline" className="text-xs">
                    {issue.category}
                  </Badge>
                  {issue.status !== 'open' && (
                    <Badge variant="secondary" className="text-xs">
                      {issue.status}
                    </Badge>
                  )}
                  {issue.isMine && (
                    <Badge className="text-xs">yours</Badge>
                  )}
                </div>
                <p className="text-sm text-ink-3 line-clamp-2 whitespace-pre-wrap">
                  {issue.body}
                </p>
                <p className="text-xs text-ink-3 mt-2">
                  {issue.commentCount ?? 0} comments
                </p>
              </div>
              <Button
                size="sm"
                variant={issue.hasUpvoted ? 'default' : 'outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleUpvote.mutate(issue._id);
                }}
                aria-pressed={issue.hasUpvoted}
                aria-label={
                  issue.hasUpvoted
                    ? `Remove upvote (${issue.upvoteCount})`
                    : `Upvote (${issue.upvoteCount})`
                }
              >
                <span aria-hidden>↑</span>
                <span className="ml-1">{issue.upvoteCount}</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <NewIssueSheet open={composerOpen} onOpenChange={setComposerOpen} />
      <IssueDetailDialog
        issueId={detailIssueId}
        onOpenChange={(open) => {
          if (!open) setDetailIssueId(null);
        }}
      />
    </div>
  );
}
