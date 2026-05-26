import { Document, Types } from 'mongoose';
import { IPaginationInput } from './pagination.types';

export type GoalCategory = 'savings' | 'travel' | 'home' | 'emergency' | 'other';
export type GoalStatus = 'active' | 'completed' | 'abandoned';
export type GoalPriority = 'low' | 'normal' | 'high';

export const GOAL_CATEGORIES: GoalCategory[] = ['savings', 'travel', 'home', 'emergency', 'other'];
export const GOAL_PRIORITIES: GoalPriority[] = ['low', 'normal', 'high'];

export interface IGoalContribution {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  amount: number;
  note?: string;
  createdAt: Date;
}

export interface IGoal extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: Date;
  status: GoalStatus;
  category?: GoalCategory;
  priority: GoalPriority;
  createdByUserId: Types.ObjectId;
  completedAt?: Date;
  contributions: IGoalContribution[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IListGoalsInput extends IPaginationInput {
  status?: GoalStatus;
}

export interface IAddGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: string;
  category?: GoalCategory;
}

export interface IUpdateGoalInput {
  name?: string;
  description?: string;
  targetAmount?: number;
  deadline?: string | null;
  category?: GoalCategory;
  status?: 'completed' | 'abandoned';
}

export interface ISetGoalPriorityInput {
  priority: GoalPriority;
}

export interface IAddContributionInput {
  amount: number;
  note?: string;
}

export interface IGoalContributionResponse {
  _id: string;
  memberId: string;
  memberNickname: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface IGoalResponse {
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
  contributions: IGoalContributionResponse[];
  createdAt: string;
  updatedAt: string;
}
