export const RECURRENCE_INTERVALS = ['monthly', 'weekly'] as const;
export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export interface RecurringTaskResponse {
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

export interface CreateRecurringTaskInput {
  title: string;
  notes?: string;
  interval: RecurrenceInterval;
  assignedToMemberId?: string;
}

export interface UpdateRecurringTaskInput {
  title?: string;
  notes?: string;
  interval?: RecurrenceInterval;
  assignedToMemberId?: string | null;
}
