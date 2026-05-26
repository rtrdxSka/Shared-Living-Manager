import type { VoteThreshold } from './vote.types';

export type IssueCategory =
  | 'cleaning'
  | 'noise'
  | 'finance'
  | 'guests'
  | 'maintenance'
  | 'other';
export const ISSUE_CATEGORIES: readonly IssueCategory[] = [
  'cleaning',
  'noise',
  'finance',
  'guests',
  'maintenance',
  'other',
] as const;

export type IssueStatus = 'open' | 'escalated' | 'archived';
export const ISSUE_STATUSES: readonly IssueStatus[] = ['open', 'escalated', 'archived'] as const;

export interface IssueResponse {
  _id: string;
  householdId: string;
  title: string;
  body: string;
  category: IssueCategory;
  status: IssueStatus;
  escalatedToVoteId?: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  isMine: boolean;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  _id: string;
  issueId: string;
  body: string;
  isMine: boolean;
  createdAt: string;
}

export interface IssueDetailResponse extends IssueResponse {
  comments: IssueComment[];
}

export interface IssueModerationResponse extends IssueResponse {
  authorId: string;
  authorNickname: string;
}

export interface IssueListResponse {
  items: IssueResponse[];
  nextCursor: string | null;
}

export interface CreateIssueInput {
  title: string;
  body: string;
  category: IssueCategory;
}

export interface EscalateIssueInput {
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold?: VoteThreshold;
  deadlineDays?: number;
}
