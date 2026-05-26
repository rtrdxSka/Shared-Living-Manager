import { Schema, model } from 'mongoose';
import { IIssueComment } from '../types/issue.types';

const issueCommentSchema = new Schema<IIssueComment>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, r: Record<string, unknown>) => { delete r.__v; return r; } },
  }
);

issueCommentSchema.index({ issueId: 1, createdAt: 1 });

export const IssueComment = model<IIssueComment>('IssueComment', issueCommentSchema);
