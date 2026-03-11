import { Document, Types } from 'mongoose';

export const RECURRENCE_INTERVALS = ['monthly', 'weekly'] as const;
export type RecurrenceInterval = typeof RECURRENCE_INTERVALS[number];

export interface IRecurringTask extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  title: string;
  notes?: string;
  interval: RecurrenceInterval;
  assignedToMemberId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateRecurringTaskInput {
  title: string;
  notes?: string;
  interval: RecurrenceInterval;
  assignedToMemberId?: string;
}

export interface IUpdateRecurringTaskInput {
  title?: string;
  notes?: string;
  interval?: RecurrenceInterval;
  assignedToMemberId?: string | null;
}

export interface IRecurringTaskResponse {
  _id: string;
  householdId: string;
  createdByUserId: string;
  title: string;
  notes?: string;
  interval: RecurrenceInterval;
  assignedToMemberId?: string;
  assignedToNickname?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
