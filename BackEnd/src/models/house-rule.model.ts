import { Schema, model } from 'mongoose';
import { IHouseRule } from '../types/house-rule.types';

const houseRuleSchema = new Schema<IHouseRule>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    sourceVoteId: { type: Schema.Types.ObjectId, ref: 'Vote', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    passedAt: { type: Date, required: true },
    archivedAt: { type: Date, default: undefined },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, r: Record<string, unknown>) => { delete r.__v; return r; } },
  }
);

houseRuleSchema.index({ householdId: 1, archivedAt: 1 });
houseRuleSchema.index({ householdId: 1, passedAt: -1 });

export const HouseRule = model<IHouseRule>('HouseRule', houseRuleSchema);
