import { Schema, model } from 'mongoose';
import { IRecurringExpense, RECURRENCE_INTERVALS, PAYER_MODES } from '../types/recurring-expense.types';
import { EXPENSE_TYPES } from '../types/household.types';

const recurringExpenseSchema = new Schema<IRecurringExpense>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
    category: {
      type: String,
      required: true,
      enum: { values: EXPENSE_TYPES, message: 'Invalid category' },
    },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    interval: {
      type: String,
      required: true,
      enum: { values: RECURRENCE_INTERVALS, message: 'Invalid interval' },
    },
    payerMode: {
      type: String,
      required: true,
      enum: { values: PAYER_MODES, message: 'Invalid payer mode' },
    },
    fixedPayerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    isActive: { type: Boolean, required: true, default: true },
    isFullRepayment: { type: Boolean, required: true, default: false },
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

recurringExpenseSchema.index({ householdId: 1, isActive: 1 });
recurringExpenseSchema.index({ interval: 1, isActive: 1 });
// Supports findOne({ _id, householdId }) household-scoping on writes/reads
recurringExpenseSchema.index({ _id: 1, householdId: 1 });

export const RecurringExpense = model<IRecurringExpense>('RecurringExpense', recurringExpenseSchema);
