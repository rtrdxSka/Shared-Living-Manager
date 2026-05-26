export type TransactionType = 'deposit' | 'withdrawal';
export type ContributionTargetMode = 'equal' | 'proportional';

export interface JointAccountTransactionResponse {
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

export interface JointAccountMemberBreakdown {
  memberId: string;
  nickname: string;
  deposits: number;
  withdrawals: number;
  targetAmount?: number;
}

export type ActivityKind = 'transaction' | 'expense';

export interface ActivityItemResponse {
  _id: string;
  kind: ActivityKind;
  type: 'deposit' | 'withdrawal' | 'expense';
  amount: number;
  date: string;
  memberNickname: string;
  note?: string;
  category?: string;
}

export interface JointAccountSummaryResponse {
  balance: number;
  monthlyDeposits: number;
  monthlyWithdrawals: number;
  monthlyExpenses: number;
  monthlyNet: number;
  monthlyTarget?: number;
  targetMode?: ContributionTargetMode;
  memberBreakdown: JointAccountMemberBreakdown[];
  transactions: JointAccountTransactionResponse[];
  transactionTotal: number;
  transactionPage: number;
  transactionTotalPages: number;
  activity: ActivityItemResponse[];
  activityTotal: number;
  activityPage: number;
  activityTotalPages: number;
}

export interface AddTransactionInput {
  type: TransactionType;
  amount: number;
  note?: string;
}

export interface UpdateJointAccountConfigInput {
  monthlyTarget?: number | null;
  targetMode?: ContributionTargetMode;
}
