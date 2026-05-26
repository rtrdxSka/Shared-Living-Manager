import { Schema } from 'mongoose';

export const customSplitOverrideSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pct: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false }
);
