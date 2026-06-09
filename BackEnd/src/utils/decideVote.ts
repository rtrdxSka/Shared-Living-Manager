import type { VoteThreshold } from '../types/vote.types';

export type VoteOutcome = 'pass' | 'reject' | 'undecided';

export interface DecideVoteInput {
  yes: number;
  no: number;
  abstain: number;
  /** Total eligible household members who may vote. */
  eligibleVoters: number;
  threshold: VoteThreshold;
  /**
   * `true` when no further ballots can arrive (deadline reached or an admin is
   * closing the vote now). A non-passing `final` tally resolves to `reject`
   * instead of `undecided`.
   */
  final: boolean;
}

/**
 * Minimum number of YES ballots required to pass, expressed as a fraction of
 * ALL eligible household members (not of the ballots cast). Abstaining or not
 * voting therefore counts as "not yes".
 *
 *   simple_majority → strictly more than half   → floor(N/2) + 1
 *   supermajority   → at least two thirds        → ceil(2N/3)
 *   unanimous       → every member               → N
 */
export function requiredYes(threshold: VoteThreshold, eligibleVoters: number): number {
  const n = Math.max(0, eligibleVoters);
  if (threshold === 'simple_majority') return Math.floor(n / 2) + 1;
  if (threshold === 'supermajority') return Math.ceil((2 * n) / 3);
  if (threshold === 'unanimous') return n;
  // Defensive: enum is constrained at the schema level. Treat unknown as
  // unanimous so accidental new values never auto-pass.
  return n;
}

/**
 * Decide a vote's outcome from the current tally. Auto-close logic and the
 * deadline/manual close share this so they never diverge:
 *
 *   - `yes >= requiredYes`                 → pass (enough support already)
 *   - `final` and not passing              → reject (no more ballots coming)
 *   - `maxPossibleYes < requiredYes`       → reject (can't get there even if
 *                                            every remaining member votes yes)
 *   - otherwise                            → undecided (keep the vote open)
 *
 * Cast ballots are treated as committed; only members who have not voted yet
 * count as swing votes. Closing locks ballots in — consistent with the manual
 * and deadline close paths.
 */
export function decideVote(input: DecideVoteInput): VoteOutcome {
  const req = requiredYes(input.threshold, input.eligibleVoters);
  if (input.yes >= req) return 'pass';

  const voted = input.yes + input.no + input.abstain;
  const remaining = Math.max(0, input.eligibleVoters - voted);
  const maxPossibleYes = input.yes + remaining;

  if (input.final) return 'reject';
  if (maxPossibleYes < req) return 'reject';
  return 'undecided';
}
