import type {
  LivingArrangement,
  Relationship,
  AgeGroup,
  FinanceMode,
  ExpenseSplitMethod,
  ExpenseType,
  TaskManagementLevel,
  TaskDistributionMethod,
  UIMode,
  Currency,
  OnboardingSurveyData,
} from './onboarding.types';
import type { ContributionTargetMode } from './joint-account.types';

// ── Household Role ────────────────────────────────────────────────────

export type HouseholdRole = 'owner' | 'admin' | 'member';

// ── API Response DTOs ─────────────────────────────────────────────────

export interface HouseholdMemberResponse {
  _id: string;
  userId?: string;
  nickname: string;
  relationship?: Relationship;
  ageGroup: AgeGroup;
  role: HouseholdRole;
  participatesInFinances: boolean;
  participatesInTasks: boolean;
  familyGroup?: string;
  email?: string;
  isCreator: boolean;
  joinedAt: string;
  monthlyIncome?: number;
}

export interface HouseholdSettings {
  financeMode?: FinanceMode;
  expenseSplitMethod?: ExpenseSplitMethod;
  customSplitPercentage?: number;
  /** Per-member custom percentages (roommate-style); sums to 100. */
  customSplitShares?: { userId: string; pct: number }[];
  trackedExpenseTypes: ExpenseType[];
  currency: Currency;
  taskManagementEnabled: TaskManagementLevel;
  taskDistributionMethod?: TaskDistributionMethod;
  jointAccountConfig?: {
    monthlyTarget?: number;
    targetMode?: ContributionTargetMode;
  };
}

export interface UpdateHouseholdSettingsInput {
  financeMode?: FinanceMode;
  expenseSplitMethod?: ExpenseSplitMethod;
  customSplitPercentage?: number;
  customSplitShares?: { userId: string; pct: number }[];
}

export interface Settlement {
  _id: string;
  month: string;
  amount: number;
  settledByUserId: string;
  settledAt: string;
}

export interface HouseholdResponse {
  _id: string;
  name: string;
  livingArrangement: LivingArrangement;
  livingArrangementOther?: string;
  totalMembers: number;
  uiMode: UIMode;
  members: HouseholdMemberResponse[];
  settlements: Settlement[];
  settings: HouseholdSettings;
  createdBy: string;
  inviteCode: string;
  /** ISO timestamp at which the current invite code stops working. */
  inviteCodeExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ──────────────────────────────────────────────────────

export type CreateHouseholdInput = OnboardingSurveyData;

export interface JoinHouseholdInput {
  inviteCode: string;
}
