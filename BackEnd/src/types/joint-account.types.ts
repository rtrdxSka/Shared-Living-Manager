import { Document, Types } from 'mongoose';

// ── Transaction Type ─────────────────────────────────────────────────

export const TRANSACTION_TYPES = ['deposit', 'withdrawal'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ── Contribution Target Mode ─────────────────────────────────────────

export const CONTRIBUTION_TARGET_MODES = ['equal', 'proportional'] as const;

export type ContributionTargetMode = (typeof CONTRIBUTION_TARGET_MODES)[number];

// ── Joint Account Config (embedded in HouseholdSettings) ─────────────

export interface IJointAccountConfig {
  monthlyTarget?: number;
  targetMode?: ContributionTargetMode;
}

// ── Joint Account Transaction Document ───────────────────────────────

export interface IJointAccountTransaction extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  memberId: Types.ObjectId;        // household member._id
  userId: Types.ObjectId;           // User._id who performed the action
  type: TransactionType;
  amount: number;                   // always positive, min 0.01
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Service Input DTOs ───────────────────────────────────────────────

export interface IAddTransactionInput {
  type: TransactionType;
  amount: number;
  note?: string;
}

export interface IUpdateJointAccountConfigInput {
  monthlyTarget?: number | null;    // null clears the target
  targetMode?: ContributionTargetMode;
}

// ── API Response DTOs ────────────────────────────────────────────────

export interface IJointAccountTransactionResponse {
  _id: string;
  householdId: string;
  memberId: string;
  memberNickname: string;
  userId: string;
  type: TransactionType;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface IJointAccountMemberBreakdown {
  memberId: string;
  nickname: string;
  deposits: number;
  withdrawals: number;
  targetAmount?: number;
}

export interface IJointAccountSummaryResponse {
  balance: number;                  // all-time: deposits - withdrawals - expenses
  monthlyDeposits: number;
  monthlyWithdrawals: number;
  monthlyExpenses: number;
  monthlyNet: number;               // deposits - withdrawals - expenses for the month
  monthlyTarget?: number;
  targetMode?: ContributionTargetMode;
  memberBreakdown: IJointAccountMemberBreakdown[];
  transactions: IJointAccountTransactionResponse[];
  transactionTotal: number;
  transactionPage: number;
  transactionTotalPages: number;
}
