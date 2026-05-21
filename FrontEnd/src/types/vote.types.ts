export type VoteThreshold = 'simple_majority' | 'supermajority' | 'unanimous';
export const VOTE_THRESHOLDS: readonly VoteThreshold[] = [
  'simple_majority',
  'supermajority',
  'unanimous',
] as const;

export type VoteStatus = 'open' | 'passed' | 'rejected' | 'closed_early';
export const VOTE_STATUSES: readonly VoteStatus[] = [
  'open',
  'passed',
  'rejected',
  'closed_early',
] as const;

export type BallotChoice = 'yes' | 'no' | 'abstain';
export const BALLOT_CHOICES: readonly BallotChoice[] = ['yes', 'no', 'abstain'] as const;

export interface VoteTally {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  eligibleVoters: number;
}

export interface VoteResponse {
  _id: string;
  householdId: string;
  sourceIssueId?: string;
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold: VoteThreshold;
  deadline: string;
  status: VoteStatus;
  closedAt?: string;
  tally: VoteTally;
  myBallot?: BallotChoice;
  createdAt: string;
  updatedAt: string;
}

export interface VoteListResponse {
  items: VoteResponse[];
}

export interface CreateVoteInput {
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold?: VoteThreshold;
  deadlineDays?: number;
  sourceIssueId?: string;
}

export interface CastBallotInput {
  choice: BallotChoice;
}
