export interface TaskResponse {
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
  assignedToMemberId?: string;
  assignedToNickname?: string;
  recurringTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignTaskInput {
  assignedToMemberId: string | null;
}

export interface AddTaskInput {
  title: string;
  notes?: string;
  dueDate?: string;  // "YYYY-MM-DD"
  assignedToMemberId?: string;
}

export interface RotationStatus {
  currentMemberId: string;
  currentNickname: string;
  nextMemberId: string;
  nextNickname: string;
  periodDays: number;
  currentPeriodStartDate: string;
  nextPeriodStartDate: string;
}
