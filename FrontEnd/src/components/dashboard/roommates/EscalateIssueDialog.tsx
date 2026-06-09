import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { useDashboard } from '@/contexts/useDashboard';
import { useEscalateIssue, useIssue } from '@/hooks/queries/useIssueQueries';
import { extractApiError } from '@/utils/extractApiError';

import { VoteProposalForm } from './VoteProposalForm';

interface EscalateIssueDialogProps {
  issueId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the issue has been successfully escalated to a vote. */
  onEscalated?: () => void;
}

export function EscalateIssueDialog({
  issueId,
  open,
  onOpenChange,
  onEscalated,
}: EscalateIssueDialogProps) {
  const { household } = useDashboard();
  const escalate = useEscalateIssue(household._id);

  // Pull the source issue so we can prefill the proposal with sensible defaults.
  const { data: issue } = useIssue(
    household._id,
    open && issueId ? issueId : undefined,
  );

  const [error, setError] = useState<string | null>(null);

  // Reset transient state on close so the next open is fresh.
  const handleClose = useCallback(() => {
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // ESC closes when no escalation write is in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !escalate.isPending) {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, escalate.isPending, handleClose]);

  if (!open || !issueId) return null;

  const titleId = 'escalate-issue-title';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        // Click on the backdrop (not the inner panel) closes the dialog.
        if (e.target === e.currentTarget && !escalate.isPending) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-surface text-ink p-6 shadow-hero">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 id={titleId} className="text-lg font-semibold flex-1">
            Escalate to vote
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            disabled={escalate.isPending}
            className="rounded-sm text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-ink-3 mb-4">
          Propose a clear rule for everyone to vote on. The original issue
          stays linked for context.
        </p>

        <VoteProposalForm
          initialTitle={issue?.title ?? ''}
          initialText={issue?.body ?? ''}
          submitLabel="Open vote"
          isSubmitting={escalate.isPending}
          errorMessage={error}
          onCancel={handleClose}
          onSubmit={async (input) => {
            setError(null);
            try {
              await escalate.mutateAsync({ issueId, input });
              // Signal the parent deterministically so it can close the detail
              // modal, rather than relying on a not-yet-refetched issue field.
              onEscalated?.();
              handleClose();
            } catch (err) {
              setError(extractApiError(err, 'Failed to open vote.'));
            }
          }}
        />
      </div>
    </div>
  );
}
