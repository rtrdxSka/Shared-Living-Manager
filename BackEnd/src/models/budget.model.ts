import { Schema, model } from 'mongoose';
import { IBudget } from '../types/budget.types';

const budgetSchema = new Schema<IBudget>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true, unique: true },
    categories: {
      rent: { type: Number, min: 0, default: undefined },
      utilities: { type: Number, min: 0, default: undefined },
      internet: { type: Number, min: 0, default: undefined },
      groceries: { type: Number, min: 0, default: undefined },
      cleaning: { type: Number, min: 0, default: undefined },
      subscriptions: { type: Number, min: 0, default: undefined },
      other: { type: Number, min: 0, default: undefined },
    },
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

export const Budget = model<IBudget>('Budget', budgetSchema);
