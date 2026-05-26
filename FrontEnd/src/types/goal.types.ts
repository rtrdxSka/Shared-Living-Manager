export type GoalCategory = 'savings' | 'travel' | 'home' | 'emergency' | 'other';
export type GoalStatus = 'active' | 'completed' | 'abandoned';
export type GoalPriority = 'low' | 'normal' | 'high';

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'travel', label: 'Travel' },
  { value: 'home', label: 'Home' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

export interface GoalContributionResponse {
  _id: string;
  memberId: string;
  memberNickname: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface GoalResponse {
  _id: string;
  householdId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: GoalStatus;
  category?: GoalCategory;
  priority: GoalPriority;
  createdByUserId: string;
  completedAt?: string;
  contributions: GoalContributionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface AddGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: string;
  category?: GoalCategory;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  targetAmount?: number;
  deadline?: string | null;
  category?: GoalCategory;
  status?: 'completed' | 'abandoned';
}

export interface AddContributionInput {
  amount: number;
  note?: string;
}
