import { Schema, model } from 'mongoose';
import { IVoteBallot, BALLOT_CHOICES } from '../types/vote.types';

const voteBallotSchema = new Schema<IVoteBallot>(
  {
    voteId: { type: Schema.Types.ObjectId, ref: 'Vote', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    choice: { type: String, enum: BALLOT_CHOICES, required: true },
    castAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, r: Record<string, unknown>) => { delete r.__v; return r; } },
  }
);

// CRITICAL: one ballot per (vote, user). Service uses findOneAndUpdate({ voteId, userId }, ..., { upsert: true })
// to support change-vote. Must be unique.
voteBallotSchema.index({ voteId: 1, userId: 1 }, { unique: true });

export const VoteBallot = model<IVoteBallot>('VoteBallot', voteBallotSchema);
