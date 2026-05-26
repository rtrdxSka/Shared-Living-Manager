import { Document, Types } from 'mongoose';

export const ISSUE_CATEGORIES = ['cleaning','noise','finance','guests','maintenance','other'] as const;
export type IssueCategory = typeof ISSUE_CATEGORIES[number];

export const ISSUE_STATUSES = ['open','escalated','archived'] as const;
export type IssueStatus = typeof ISSUE_STATUSES[number];

export interface IIssue extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  body: string;
  category: IssueCategory;
  status: IssueStatus;
  escalatedToVoteId?: Types.ObjectId;
  upvotedBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IIssueComment extends Document {
  _id: Types.ObjectId;
  issueId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateIssueInput {
  title: string;
  body: string;
  category: IssueCategory;
}

export interface IEscalateIssueInput {
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold?: 'simple_majority' | 'supermajority' | 'unanimous';
  deadlineDays?: number;
}

export interface IIssueResponse {
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

export interface IIssueCommentResponse {
  _id: string;
  issueId: string;
  body: string;
  isMine: boolean;
  createdAt: string;
}

export interface IIssueDetailResponse extends IIssueResponse {
  comments: IIssueCommentResponse[];
}

export interface IIssueModerationResponse extends IIssueResponse {
  authorId: string;
  authorNickname: string;
}

export interface IIssueListResponse {
  items: IIssueResponse[];
  nextCursor: string | null;
}
