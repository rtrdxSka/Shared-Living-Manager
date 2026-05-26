import { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/contexts/useDashboard';
import {
  useIssue,
  useAddComment,
  useDeleteComment,
  useDeleteIssue,
} from '@/hooks/queries/useIssueQueries';
import { extractApiError } from '@/utils/extractApiError';

import { EscalateIssueDialog } from './EscalateIssueDialog';

interface IssueDetailDialogProps {
  issueId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function IssueDetailDialog({
  issueId,
  onOpenChange,
}: IssueDetailDialogProps) {
  const { household } = useDashboard();
  const { data: issue, isLoading } = useIssue(
    household._id,
    issueId ?? undefined,
  );
  const addComment = useAddComment(household._id);
  const deleteComment = useDeleteComment(household._id);
  const deleteIssue = useDeleteIssue(household._id);

  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const open = !!issueId;

  // Reset transient state on close so the next open is fresh.
  const handleClose = useCallback(() => {
    setCommentText('');
    setError(null);
    setConfirmDelete(false);
    setEscalateOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // ESC closes when no destructive write is in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !addComment.isPending &&
        !deleteComment.isPending &&
        !deleteIssue.isPending &&
        !escalateOpen
      ) {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    open,
    addComment.isPending,
    deleteComment.isPending,
    deleteIssue.isPending,
    escalateOpen,
    handleClose,
  ]);

  if (!open) return null;

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!issueId) return;
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await addComment.mutateAsync({ issueId, body: trimmed });
      setCommentText('');
    } catch (err) {
      setError(extractApiError(err, 'Failed to add comment.'));
    }
  }

  async function handleDeleteIssue() {
    if (!issueId) return;
    setError(null);
    try {
      await deleteIssue.mutateAsync(issueId);
      handleClose();
    } catch (err) {
      setError(extractApiError(err, 'Failed to delete issue.'));
      setConfirmDelete(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!issue) return;
    setError(null);
    try {
      await deleteComment.mutateAsync({ issueId: issue._id, commentId });
    } catch (err) {
      setError(extractApiError(err, 'Failed to delete comment.'));
    }
  }

  const titleId = 'issue-detail-title';

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => {
          // Click on the backdrop (not the inner panel) closes the dialog.
          if (e.target === e.currentTarget && !escalateOpen) {
            handleClose();
          }
        }}
      >
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-surface text-ink p-6 shadow-hero">
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 id={titleId} className="text-lg font-semibold flex-1">
              {issue?.title ?? (isLoading ? 'Loading…' : 'Issue')}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="rounded-sm text-ink-3 hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <p className="text-sm text-ink-3">Loading issue…</p>
          )}

          {issue && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{issue.category}</Badge>
                <Badge
                  variant={issue.status === 'open' ? 'default' : 'secondary'}
                >
                  {issue.status}
                </Badge>
                {issue.isMine && (
                  <Badge variant="secondary">yours</Badge>
                )}
              </div>

              <p className="text-sm whitespace-pre-wrap">{issue.body}</p>

              <div className="border-t border-line pt-4 space-y-3">
                <h3 className="text-sm font-semibold">
                  Comments ({issue.comments.length})
                </h3>

                {issue.comments.length === 0 && (
                  <p className="text-sm text-ink-3">No comments yet.</p>
                )}

                <ul className="space-y-2">
                  {issue.comments.map((c) => (
                    <li
                      key={c._id}
                      className="text-sm flex justify-between gap-2 border-l-2 border-line pl-3 py-1"
                    >
                      <p className="whitespace-pre-wrap flex-1">{c.body}</p>
                      {c.isMine && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(c._id)}
                          disabled={deleteComment.isPending}
                        >
                          Delete
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                <form onSubmit={submitComment} className="space-y-2">
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    maxLength={1000}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment (anonymous)…"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !commentText.trim() || addComment.isPending
                    }
                  >
                    {addComment.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Comment
                  </Button>
                </form>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {issue.status === 'open' && (
                  <Button onClick={() => setEscalateOpen(true)}>
                    Escalate to vote
                  </Button>
                )}
                {issue.isMine && !confirmDelete && (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete issue
                  </Button>
                )}
                {issue.isMine && confirmDelete && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-2">
                      Delete this issue?
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteIssue}
                      disabled={deleteIssue.isPending}
                    >
                      {deleteIssue.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Confirm delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleteIssue.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EscalateIssueDialog
        issueId={issueId}
        open={escalateOpen}
        onOpenChange={(nextOpen) => {
          setEscalateOpen(nextOpen);
          // When the escalate dialog closes and the underlying issue has been
          // moved to a vote, close the detail too so the user lands back in
          // the list (Task 25 will drive this from inside EscalateIssueDialog).
          if (!nextOpen && issue?.escalatedToVoteId) {
            handleClose();
          }
        }}
      />
    </>
  );
}
