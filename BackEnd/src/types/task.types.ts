import { Document, Types } from 'mongoose';

export interface ITask extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  title: string;
  notes?: string;
  dueDate?: Date;
  createdByUserId: Types.ObjectId;
  isCompleted: boolean;
  completedAt?: Date;
  completedByMemberId?: Types.ObjectId;
  assignedToMemberId?: Types.ObjectId;
  recurringTaskId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddTaskInput {
  title: string;
  notes?: string;
  dueDate?: string;  // "YYYY-MM-DD"
  assignedToMemberId?: string;
}

export interface ITaskResponse {
  _id: string;
  householdId: string;
  title: string;
  notes?: string;
  dueDate?: string;
  createdByUserId: string;
  isCompleted: boolean;
  completedAt?: string;
  completedByMemberId?: string;
  completedByNickname?: string;
  // Rotation-computed fields (populated by service when distribution === 'rotation')
  assignedToMemberId?: string;
  assignedToNickname?: string;
  recurringTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IListTasksInput {
  cursor?: string;
  limit?: number;
}

export interface IListTasksResult {
  tasks: ITaskResponse[];
  nextCursor: string | null;
  rotation?: IRotationStatus;
}

export interface IAssignTaskInput {
  assignedToMemberId: string | null;  // null = unassign
}

export interface IRotationStatus {
  currentMemberId: string;
  currentNickname: string;
  nextMemberId: string;
  nextNickname: string;
  periodDays: number;
  currentPeriodStartDate: string;
  nextPeriodStartDate: string;
}
