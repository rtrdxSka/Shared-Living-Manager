import { Schema, model } from 'mongoose';
import { IIssue, ISSUE_CATEGORIES, ISSUE_STATUSES } from '../types/issue.types';

const issueSchema = new Schema<IIssue>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: ISSUE_CATEGORIES, required: true },
    status: { type: String, enum: ISSUE_STATUSES, default: 'open' },
    escalatedToVoteId: { type: Schema.Types.ObjectId, ref: 'Vote', default: undefined },
    upvotedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, r: Record<string, unknown>) => { delete r.__v; return r; } },
  }
);

issueSchema.index({ householdId: 1, status: 1, createdAt: -1 });
issueSchema.index({ householdId: 1, escalatedToVoteId: 1 });

export const Issue = model<IIssue>('Issue', issueSchema);
