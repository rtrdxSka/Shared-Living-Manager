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
  trackedExpenseTypes: ExpenseType[];
  currency: Currency;
  taskManagementEnabled: TaskManagementLevel;
  taskDistributionMethod?: TaskDistributionMethod;
}

export interface HouseholdResponse {
  _id: string;
  name: string;
  livingArrangement: LivingArrangement;
  livingArrangementOther?: string;
  totalMembers: number;
  uiMode: UIMode;
  members: HouseholdMemberResponse[];
  settings: HouseholdSettings;
  createdBy: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ──────────────────────────────────────────────────────

export type CreateHouseholdInput = OnboardingSurveyData;

export interface JoinHouseholdInput {
  inviteCode: string;
}
