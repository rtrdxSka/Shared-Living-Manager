import { Schema } from 'mongoose';
import { IExpenseDebtorState } from '../../types/expense.types';

export const expenseDebtorStateSchema = new Schema<IExpenseDebtorState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    share: { type: Number, required: true, min: 0 },
    claimedAt: { type: Date, default: undefined },
    confirmedAt: { type: Date, default: undefined },
    disputedAt: { type: Date, default: undefined },
  },
  { _id: false }
);
