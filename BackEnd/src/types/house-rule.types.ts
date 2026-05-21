import { Document, Types } from 'mongoose';

export interface IHouseRule extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  sourceVoteId: Types.ObjectId;
  title: string;
  text: string;
  passedAt: Date;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHouseRuleResponse {
  _id: string;
  householdId: string;
  sourceVoteId: string;
  title: string;
  text: string;
  passedAt: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IHouseRuleListResponse {
  items: IHouseRuleResponse[];
}
