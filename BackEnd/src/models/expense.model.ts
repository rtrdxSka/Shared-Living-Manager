import { Schema, model } from 'mongoose';
import { IExpense } from '../types/expense.types';
import { EXPENSE_TYPES } from '../types/household.types';

const expenseSchema = new Schema<IExpense>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    paidByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recurringExpenseId: { type: Schema.Types.ObjectId, ref: 'RecurringExpense', default: undefined },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
    category: {
      type: String,
      required: true,
      enum: { values: EXPENSE_TYPES, message: 'Invalid category' },
    },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    isResolved: { type: Boolean, default: false },
    isFullRepayment: { type: Boolean, required: true, default: false },
    resolvedAt: { type: Date, default: undefined },
    resolvedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    pendingConfirmation: { type: Boolean, default: false },
    pendingConfirmationAt: { type: Date, default: undefined },
    pendingConfirmationByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    lastDisputedAt: { type: Date, default: undefined },
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

// Primary access pattern: filter by household + date range
expenseSchema.index({ householdId: 1, date: -1 });
// Support category filter on top
expenseSchema.index({ householdId: 1, category: 1, date: -1 });
// Prevent duplicate recurring expense instances for the same period
expenseSchema.index(
  { recurringExpenseId: 1, date: 1 },
  { unique: true, partialFilterExpression: { recurringExpenseId: { $exists: true } } }
);

export const Expense = model<IExpense>('Expense', expenseSchema);
