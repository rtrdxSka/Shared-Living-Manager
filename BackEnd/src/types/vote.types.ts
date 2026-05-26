import { Document, Types } from 'mongoose';

export const VOTE_THRESHOLDS = ['simple_majority', 'supermajority', 'unanimous'] as const;
export type VoteThreshold = typeof VOTE_THRESHOLDS[number];

export const VOTE_STATUSES = ['open', 'passed', 'rejected', 'closed_early'] as const;
export type VoteStatus = typeof VOTE_STATUSES[number];

export const BALLOT_CHOICES = ['yes', 'no', 'abstain'] as const;
export type BallotChoice = typeof BALLOT_CHOICES[number];

export interface IVote extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  sourceIssueId?: Types.ObjectId;
  proposedRuleTitle: string;
  proposedRuleText: string;
  proposedBy: Types.ObjectId;
  threshold: VoteThreshold;
  deadline: Date;
  status: VoteStatus;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVoteBallot extends Document {
  _id: Types.ObjectId;
  voteId: Types.ObjectId;
  userId: Types.ObjectId;
  choice: BallotChoice;
  castAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateVoteInput {
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold?: VoteThreshold;
  deadlineDays?: number;
  sourceIssueId?: string;
}

export interface ICastBallotInput {
  choice: BallotChoice;
}

export interface IVoteTally {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  eligibleVoters: number;
}

export interface IVoteResponse {
  _id: string;
  householdId: string;
  sourceIssueId?: string;
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold: VoteThreshold;
  deadline: string;
  status: VoteStatus;
  closedAt?: string;
  tally: IVoteTally;
  myBallot?: BallotChoice;
  createdAt: string;
  updatedAt: string;
}

export interface IVoteListResponse {
  items: IVoteResponse[];
}
