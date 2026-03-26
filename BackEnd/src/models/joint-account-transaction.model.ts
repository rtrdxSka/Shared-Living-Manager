import { Schema, model } from 'mongoose';
import { IJointAccountTransaction, TRANSACTION_TYPES } from '../types/joint-account.types';

const jointAccountTransactionSchema = new Schema<IJointAccountTransaction>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    memberId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: { values: TRANSACTION_TYPES, message: 'Invalid transaction type' },
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'Note cannot exceed 200 characters'],
      default: undefined,
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

// Primary: household + date for monthly queries
jointAccountTransactionSchema.index({ householdId: 1, createdAt: -1 });
// Secondary: household + member for per-person summaries
jointAccountTransactionSchema.index({ householdId: 1, memberId: 1, createdAt: -1 });

export const JointAccountTransaction = model<IJointAccountTransaction>(
  'JointAccountTransaction',
  jointAccountTransactionSchema
);
