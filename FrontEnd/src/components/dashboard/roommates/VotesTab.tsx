import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDashboard } from '@/contexts/useDashboard';
import {
  useCastBallot,
  useCloseVote,
  useVotes,
} from '@/hooks/queries/useVoteQueries';
import {
  BALLOT_CHOICES,
  type BallotChoice,
  type VoteResponse,
  type VoteTally,
} from '@/types/vote.types';
import { extractApiError } from '@/utils/extractApiError';

import { NewVoteSheet } from './NewVoteSheet';

function deadlineLabel(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'closing';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `in ${mins}m`;
}

function TallyBar({ tally }: { tally: VoteTally }) {
  const total = tally.yes + tally.no + tally.abstain;
  const needed = `${tally.yes}/${tally.requiredYes} yes needed to pass`;
  if (total === 0) {
    return (
      <p className="text-xs text-ink-3">
        No ballots cast yet · {needed} ({tally.eligibleVoters} members)
      </p>
    );
  }
  const yesPct = (tally.yes / total) * 100;
  const noPct = (tally.no / total) * 100;
  const abstainPct = (tally.abstain / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded overflow-hidden bg-surface-2">
        <div style={{ width: `${yesPct}%` }} className="bg-green-500" />
        <div style={{ width: `${noPct}%` }} className="bg-red-500" />
        <div style={{ width: `${abstainPct}%` }} className="bg-ink-3/40" />
      </div>
      <p className="text-xs text-ink-3">
        {tally.yes} yes · {tally.no} no · {tally.abstain} abstain ·{' '}
        {total}/{tally.eligibleVoters} cast · {needed}
      </p>
    </div>
  );
}

interface OpenVoteCardProps {
  vote: VoteResponse;
  isAdmin: boolean;
  onCast: (choice: BallotChoice) => void;
  onClose: () => void;
  isCasting: boolean;
  isClosing: boolean;
  error: string | null;
}

function OpenVoteCard({
  vote,
  isAdmin,
  onCast,
  onClose,
  isCasting,
  isClosing,
  error,
}: OpenVoteCardProps) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{vote.proposedRuleTitle}</h3>
          <p className="text-sm text-ink-3 mt-1 whitespace-pre-wrap">
            {vote.proposedRuleText}
          </p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {vote.threshold.replace('_', ' ')}
        </Badge>
      </div>

      <p className="text-xs text-ink-3">Closes {deadlineLabel(vote.deadline)}</p>

      <TallyBar tally={vote.tally} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {BALLOT_CHOICES.map((c) => (
          <Button
            key={c}
            size="sm"
            disabled={isCasting}
            variant={vote.myBallot === c ? 'default' : 'outline'}
            onClick={() => onCast(c)}
            aria-pressed={vote.myBallot === c}
          >
            {c}
          </Button>
        ))}
        {vote.myBallot && (
          <span className="text-xs text-ink-3">
            You can change your vote until it closes.
          </span>
        )}
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isClosing}
            onClick={onClose}
            className="ml-auto"
          >
            {isClosing ? 'Closing…' : 'Close now'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function HistoricalVoteRow({ vote }: { vote: VoteResponse }) {
  const statusVariant: Record<
    VoteResponse['status'],
    'default' | 'destructive' | 'secondary'
  > = {
    open: 'secondary',
    passed: 'default',
    rejected: 'destructive',
    closed_early: 'secondary',
  };
  return (
    <Card className="p-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h4 className="text-sm font-medium truncate">{vote.proposedRuleTitle}</h4>
        <p className="text-xs text-ink-3">
          {vote.tally.yes} yes / {vote.tally.no} no · closed{' '}
          {vote.closedAt ? new Date(vote.closedAt).toLocaleDateString() : '?'}
        </p>
      </div>
      <Badge variant={statusVariant[vote.status] ?? 'secondary'} className="shrink-0">
        {vote.status.replace('_', ' ')}
      </Badge>
    </Card>
  );
}

export function VotesTab() {
  const { household, currentUserId } = useDashboard();
  const role = household.members.find(
    (m) => m.userId?.toString() === currentUserId
  )?.role;
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: open } = useVotes(household._id, { status: 'open' });
  const { data: passed } = useVotes(household._id, { status: 'passed' });
  const { data: rejected } = useVotes(household._id, { status: 'rejected' });
  const { data: closedEarly } = useVotes(household._id, {
    status: 'closed_early',
  });

  const historical = [
    ...(passed?.items ?? []),
    ...(rejected?.items ?? []),
    ...(closedEarly?.items ?? []),
  ].sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));

  const castBallot = useCastBallot(household._id);
  const closeVote = useCloseVote(household._id);
  const [actionError, setActionError] = useState<{
    voteId: string;
    msg: string;
  } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  async function handleCast(voteId: string, choice: BallotChoice) {
    setActionError(null);
    try {
      await castBallot.mutateAsync({ voteId, choice });
    } catch (err) {
      setActionError({
        voteId,
        msg: extractApiError(err, 'Failed to cast ballot.'),
      });
    }
  }

  async function handleClose(voteId: string) {
    setActionError(null);
    try {
      await closeVote.mutateAsync(voteId);
    } catch (err) {
      setActionError({
        voteId,
        msg: extractApiError(err, 'Failed to close vote.'),
      });
    }
  }

  const openItems = open?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Active votes</h2>
        <Button onClick={() => setComposerOpen(true)}>Propose new vote</Button>
      </div>

      {openItems.length === 0 && (
        <p className="text-sm text-ink-3">
          No active votes. Escalate an issue or propose one directly.
        </p>
      )}

      <div className="space-y-3">
        {openItems.map((v) => (
          <OpenVoteCard
            key={v._id}
            vote={v}
            isAdmin={isAdmin}
            onCast={(c) => handleCast(v._id, c)}
            onClose={() => handleClose(v._id)}
            isCasting={castBallot.isPending}
            isClosing={closeVote.isPending}
            error={actionError?.voteId === v._id ? actionError.msg : null}
          />
        ))}
      </div>

      {historical.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Historical</h2>
          <div className="space-y-2">
            {historical.map((v) => (
              <HistoricalVoteRow key={v._id} vote={v} />
            ))}
          </div>
        </div>
      )}

      <NewVoteSheet open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}
