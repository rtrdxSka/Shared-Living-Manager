import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { useDashboard } from '@/contexts/useDashboard';
import {
  useCastBallot,
  useVotes,
} from '@/hooks/queries/useVoteQueries';
import { BALLOT_CHOICES, type BallotChoice } from '@/types/vote.types';
import { extractApiError } from '@/utils/extractApiError';

/**
 * Preview card showing the three most-urgent open votes (ascending deadline)
 * with inline quick-ballot buttons. Mirrors the VotesTab interaction so the
 * overview is a working surface, not just a teaser.
 */
export function OpenVotesPreviewCard() {
  const { household } = useDashboard();
  const { data } = useVotes(household._id, { status: 'open' });
  const castBallot = useCastBallot(household._id);
  const [actionError, setActionError] = useState<{
    voteId: string;
    msg: string;
  } | null>(null);

  const top = (data?.items ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )
    .slice(0, 3);

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

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <EyebrowLabel as="div">OPEN VOTES</EyebrowLabel>
          <Link
            to="/dashboard/house-rules"
            className="text-xs font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-ink-3">No active votes.</p>
        ) : (
          <div className="space-y-3">
            {top.map((v) => (
              <div key={v._id} className="space-y-1.5">
                <p className="text-sm font-medium text-ink truncate">
                  {v.proposedRuleTitle}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {BALLOT_CHOICES.map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={v.myBallot === c ? 'default' : 'outline'}
                      disabled={castBallot.isPending}
                      onClick={() => handleCast(v._id, c)}
                      className="h-7 px-2 text-xs"
                      aria-pressed={v.myBallot === c}
                    >
                      {c}
                    </Button>
                  ))}
                  <span className="text-[11px] text-ink-3 ml-1">
                    {v.tally.yes}y · {v.tally.no}n · {v.tally.abstain}a
                  </span>
                </div>
                {actionError?.voteId === v._id && (
                  <p className="text-xs text-neg">{actionError.msg}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
