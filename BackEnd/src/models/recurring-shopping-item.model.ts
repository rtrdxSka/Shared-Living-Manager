import { Schema, model } from 'mongoose';
import { IRecurringShoppingItem } from '../types/recurring-shopping-item.types';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const CADENCE_VALUES = ['daily', 'weekly', 'monthly'] as const;

const recurringShoppingItemSchema = new Schema<IRecurringShoppingItem>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    category: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      required: true,
      default: 'groceries',
    },
    cadence: {
      type: String,
      enum: CADENCE_VALUES,
      required: true,
    },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

// Compound index — keeps the cron's per-cadence sweep cheap.
recurringShoppingItemSchema.index({ householdId: 1, active: 1, cadence: 1 });
recurringShoppingItemSchema.index({ active: 1, cadence: 1 });

export const RecurringShoppingItem = model<IRecurringShoppingItem>(
  'RecurringShoppingItem',
  recurringShoppingItemSchema
);
