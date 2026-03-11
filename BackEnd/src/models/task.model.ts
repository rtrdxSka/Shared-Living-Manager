import { Schema, model } from 'mongoose';
import { ITask } from '../types/task.types';

const taskSchema = new Schema<ITask>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    dueDate: { type: Date, default: undefined },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: undefined },
    completedByMemberId: { type: Schema.Types.ObjectId, default: undefined },
    assignedToMemberId: { type: Schema.Types.ObjectId, ref: 'Household.members', default: undefined },
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

taskSchema.index({ householdId: 1, createdAt: -1 });
taskSchema.index({ householdId: 1, isCompleted: 1 });

export const Task = model<ITask>('Task', taskSchema);
