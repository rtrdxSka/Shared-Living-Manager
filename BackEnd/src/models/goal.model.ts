import { Schema, model } from 'mongoose';
import { IGoal, GOAL_CATEGORIES } from '../types/goal.types';

const contributionSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true, maxlength: 200, default: undefined },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const goalSchema = new Schema<IGoal>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: undefined },
    targetAmount: { type: Number, required: true, min: 0.01 },
    deadline: { type: Date, default: undefined },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    category: { type: String, enum: GOAL_CATEGORIES, default: undefined },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: undefined },
    contributions: [contributionSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

goalSchema.index({ householdId: 1, status: 1 });
goalSchema.index({ householdId: 1, createdAt: -1 });

export const Goal = model<IGoal>('Goal', goalSchema);
