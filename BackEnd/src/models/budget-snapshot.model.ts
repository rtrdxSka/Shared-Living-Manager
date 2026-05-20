import { Schema, model } from 'mongoose';
import { IBudgetSnapshot } from '../types/budget.types';

const budgetSnapshotSchema = new Schema<IBudgetSnapshot>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    monthString: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    categories: {
      rent: { type: Number, min: 0, default: undefined },
      utilities: { type: Number, min: 0, default: undefined },
      internet: { type: Number, min: 0, default: undefined },
      groceries: { type: Number, min: 0, default: undefined },
      cleaning: { type: Number, min: 0, default: undefined },
      subscriptions: { type: Number, min: 0, default: undefined },
      other: { type: Number, min: 0, default: undefined },
    },
    frozenAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

budgetSnapshotSchema.index({ householdId: 1, monthString: 1 }, { unique: true });

export const BudgetSnapshot = model<IBudgetSnapshot>('BudgetSnapshot', budgetSnapshotSchema);
