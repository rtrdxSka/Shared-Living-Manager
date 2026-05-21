import { Schema, model } from 'mongoose';
import { IExpense } from '../types/expense.types';
import { EXPENSE_TYPES } from '../types/household.types';
import { customSplitOverrideSchema } from './_shared/expense-subgroup.schema';
import { expenseDebtorStateSchema } from './_shared/expense-debtor-state.schema';

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
    participantUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: undefined },
    customSplitOverrides: { type: [customSplitOverrideSchema], default: undefined },
    debtorStates: { type: [expenseDebtorStateSchema], default: [] },
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

expenseSchema.index({ householdId: 1, date: -1 });
expenseSchema.index({ householdId: 1, category: 1, date: -1 });
expenseSchema.index(
  { recurringExpenseId: 1, date: 1 },
  { unique: true, partialFilterExpression: { recurringExpenseId: { $exists: true } } }
);
expenseSchema.index({ _id: 1, householdId: 1 });
expenseSchema.index({ householdId: 1, participantUserIds: 1 });
expenseSchema.index({ householdId: 1, 'debtorStates.userId': 1 });

export const Expense = model<IExpense>('Expense', expenseSchema);
