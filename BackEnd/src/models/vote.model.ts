import { Schema, model } from 'mongoose';
import { IVote, VOTE_THRESHOLDS, VOTE_STATUSES } from '../types/vote.types';

const voteSchema = new Schema<IVote>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    sourceIssueId: { type: Schema.Types.ObjectId, ref: 'Issue', default: undefined },
    proposedRuleTitle: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    proposedRuleText: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    threshold: { type: String, enum: VOTE_THRESHOLDS, default: 'simple_majority' },
    deadline: { type: Date, required: true },
    status: { type: String, enum: VOTE_STATUSES, default: 'open' },
    closedAt: { type: Date, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, r: Record<string, unknown>) => { delete r.__v; return r; } },
  }
);

voteSchema.index({ householdId: 1, status: 1, deadline: 1 });
voteSchema.index({ householdId: 1, sourceIssueId: 1 });

export const Vote = model<IVote>('Vote', voteSchema);
