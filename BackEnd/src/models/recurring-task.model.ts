import { Schema, model } from 'mongoose';
import { IRecurringTask, RECURRENCE_INTERVALS } from '../types/recurring-task.types';

const recurringTaskSchema = new Schema<IRecurringTask>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    interval: {
      type: String,
      required: true,
      enum: { values: RECURRENCE_INTERVALS, message: 'Invalid interval' },
    },
    assignedToMemberId: { type: Schema.Types.ObjectId, default: undefined },
    isActive: { type: Boolean, required: true, default: true },
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

recurringTaskSchema.index({ householdId: 1, isActive: 1 });

export const RecurringTask = model<IRecurringTask>('RecurringTask', recurringTaskSchema);
