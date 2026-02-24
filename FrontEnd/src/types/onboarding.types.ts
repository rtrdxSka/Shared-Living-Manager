// ── Living Arrangement ─────────────────────────────────────────────────

export const LIVING_ARRANGEMENTS = [
  'alone',
  'couple',
  'family',
  'roommates',
  'multi_family',
  'other',
] as const;

export type LivingArrangement = (typeof LIVING_ARRANGEMENTS)[number];

// ── Relationship ──────────────────────────────────────────────────────

export const RELATIONSHIPS = [
  'partner',
  'parent',
  'child',
  'sibling',
  'friend',
  'roommate',
  'relative',
  'other',
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

// ── Age Group ─────────────────────────────────────────────────────────

export const AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

// ── Expense Split Method ──────────────────────────────────────────────

export const EXPENSE_SPLIT_METHODS = [
  'equal',
  'income_based',
  'usage_based',
  'shapley',
  'custom',
] as const;

export type ExpenseSplitMethod = (typeof EXPENSE_SPLIT_METHODS)[number];

// ── Expense Type ──────────────────────────────────────────────────────

export const EXPENSE_TYPES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

// ── Task Management Level ─────────────────────────────────────────────

export const TASK_MANAGEMENT_LEVELS = [
  'full',
  'basic',
  'disabled',
] as const;

export type TaskManagementLevel = (typeof TASK_MANAGEMENT_LEVELS)[number];

// ── Task Distribution Method ──────────────────────────────────────────

export const TASK_DISTRIBUTION_METHODS = [
  'rotation',
  'fixed',
  'ai',
  'voluntary',
] as const;

export type TaskDistributionMethod =
  (typeof TASK_DISTRIBUTION_METHODS)[number];

// ── UI Mode (derived from survey, not user-selected) ──────────────────

export const UI_MODES = [
  'solo',
  'couple',
  'family',
  'roommates',
  'multi_family',
] as const;

export type UIMode = (typeof UI_MODES)[number];

// ── Currency ──────────────────────────────────────────────────────────

export const CURRENCIES = ['BGN', 'EUR', 'USD', 'GBP'] as const;

export type Currency = (typeof CURRENCIES)[number];

// ── Data structures ───────────────────────────────────────────────────

/** The household creator's own profile within the household */
export interface CreatorProfile {
  nickname: string;
  ageGroup: AgeGroup;
  participatesInFinances: boolean;
  participatesInTasks: boolean;
  familyGroup?: string;
}

export interface MemberStructureEntry {
  nickname: string;
  relationship: Relationship;
  ageGroup: AgeGroup;
  participatesInFinances: boolean;
  participatesInTasks: boolean;
  familyGroup?: string;
  email: string;
}

/** Full survey payload — submitted to backend on completion */
export interface OnboardingSurveyData {
  // Step 1: Living Arrangement
  householdName: string;
  totalMembers: number;
  livingArrangement: LivingArrangement;
  livingArrangementOther?: string;

  // Step 2: Household Structure
  creatorProfile: CreatorProfile;
  memberStructure: MemberStructureEntry[]; // empty for 'alone'

  // Step 3: Financial Preferences
  expenseSplitMethod?: ExpenseSplitMethod;
  trackedExpenseTypes: ExpenseType[];
  currency: Currency;

  // Step 4: Task Preferences
  taskManagementEnabled: TaskManagementLevel;
  taskDistributionMethod?: TaskDistributionMethod;
}

// ── Per-step data slices (for wizard state management) ─────────────────

export interface StepLivingArrangement {
  householdName: string;
  totalMembers: number;
  livingArrangement: LivingArrangement | '';
  livingArrangementOther: string;
}

export interface StepHouseholdStructure {
  creatorProfile: CreatorProfile;
  memberStructure: MemberStructureEntry[];
}

export interface StepFinancialPreferences {
  expenseSplitMethod: ExpenseSplitMethod | '';
  trackedExpenseTypes: ExpenseType[];
  currency: Currency;
}

export interface StepTaskPreferences {
  taskManagementEnabled: TaskManagementLevel | '';
  taskDistributionMethod: TaskDistributionMethod | '';
}

// ── UI option types (for rendering selectable options) ─────────────────

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

// ── UI option definitions (Bulgarian labels) ──────────────────────────

export const LIVING_ARRANGEMENT_OPTIONS: SelectOption<LivingArrangement>[] = [
  { value: 'alone', label: 'I live alone' },
  { value: 'couple', label: 'I live with a partner/spouse' },
  { value: 'family', label: 'I live with family' },
  { value: 'roommates', label: 'I live with roommates' },
  { value: 'multi_family', label: 'Multiple families together' },
  { value: 'other', label: 'Other' },
];

export const RELATIONSHIP_OPTIONS: SelectOption<Relationship>[] = [
  { value: 'partner', label: 'Partner/Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'roommate', label: 'Roommate' },
  { value: 'relative', label: 'Relative' },
  { value: 'other', label: 'Other' },
];

export const AGE_GROUP_OPTIONS: SelectOption<AgeGroup>[] = [
  { value: 'child', label: 'Child (0–12)' },
  { value: 'teenager', label: 'Teenager (13–17)' },
  { value: 'adult', label: 'Adult (18–64)' },
  { value: 'senior', label: 'Senior (65+)' },
];

export const EXPENSE_SPLIT_METHOD_OPTIONS: SelectOption<ExpenseSplitMethod>[] =
  [
    {
      value: 'equal',
      label: 'Equal split',
      description: 'Expenses are divided equally among all members',
    },
    {
      value: 'income_based',
      label: 'Income-based',
      description: 'Each member pays proportionally to their income',
    },
    {
      value: 'usage_based',
      label: 'Usage-based',
      description: 'Expenses are distributed by actual usage',
    },
    {
      value: 'shapley',
      label: 'Mathematically fair',
      description:
        'Shapley Value — an algorithm for optimally fair distribution',
    },
    {
      value: 'custom',
      label: 'Custom',
      description: 'Manually set a percentage or amount for each member',
    },
  ];

export const EXPENSE_TYPE_OPTIONS: SelectOption<ExpenseType>[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities (electricity, water, gas)' },
  { value: 'internet', label: 'Internet & TV' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'cleaning', label: 'Cleaning supplies' },
  { value: 'subscriptions', label: 'Subscriptions (Netflix, etc.)' },
  { value: 'other', label: 'Other shared expenses' },
];

export const CURRENCY_OPTIONS: SelectOption<Currency>[] = [
  { value: 'BGN', label: 'BGN (лв.)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
];

export const TASK_MANAGEMENT_OPTIONS: SelectOption<TaskManagementLevel>[] = [
  {
    value: 'full',
    label: 'Full management',
    description: 'Rotation, distribution, and tracking of all tasks',
  },
  {
    value: 'basic',
    label: 'Basic tasks',
    description: 'Simple task list without automation',
  },
  {
    value: 'disabled',
    label: 'No tasks',
    description: 'Financial management only, no task tracking',
  },
];

export const TASK_DISTRIBUTION_OPTIONS: SelectOption<TaskDistributionMethod>[] =
  [
    {
      value: 'rotation',
      label: 'Rotation',
      description: 'A different person is responsible each week',
    },
    {
      value: 'fixed',
      label: 'Fixed assignment',
      description: 'Each member has permanent tasks',
    },
    {
      value: 'ai',
      label: 'AI optimized',
      description:
        'Intelligent distribution based on preferences and workload',
    },
    {
      value: 'voluntary',
      label: 'Voluntary',
      description: 'Tasks are posted and anyone can claim them',
    },
  ];

// ── Conditional logic helpers ─────────────────────────────────────────

/** Step 2 is skipped entirely for 'alone' */
export function shouldSkipMemberStep(
  arrangement: LivingArrangement | ''
): boolean {
  return arrangement === 'alone';
}

/** Min/max/fixed constraints for totalMembers based on arrangement */
export interface MemberCountConstraints {
  min: number;
  max: number;
  /** If set, the value is locked and the stepper should be disabled */
  fixed?: number;
}

export function getMemberCountConstraints(
  arrangement: LivingArrangement | ''
): MemberCountConstraints {
  switch (arrangement) {
    case 'alone':
      return { min: 1, max: 1, fixed: 1 };
    case 'couple':
      return { min: 2, max: 2, fixed: 2 };
    case 'multi_family':
      return { min: 3, max: 20 };
    case 'family':
    case 'roommates':
      return { min: 2, max: 20 };
    default:
      return { min: 1, max: 20 };
  }
}

/** Which split methods are available per arrangement */
export function getAvailableSplitMethods(
  arrangement: LivingArrangement | ''
): ExpenseSplitMethod[] {
  switch (arrangement) {
    case 'alone':
      return []; // No split needed
    case 'couple':
      return ['equal', 'income_based', 'custom'];
    default:
      return ['equal', 'income_based', 'usage_based', 'shapley', 'custom'];
  }
}

/** Whether to show the split method section */
export function shouldShowSplitMethod(
  arrangement: LivingArrangement | ''
): boolean {
  return arrangement !== 'alone';
}

/** Which task distribution methods are available per arrangement */
export function getAvailableDistributionMethods(
  arrangement: LivingArrangement | ''
): TaskDistributionMethod[] {
  switch (arrangement) {
    case 'alone':
      return []; // No distribution for solo
    case 'couple':
      return ['rotation', 'fixed', 'voluntary'];
    default:
      return ['rotation', 'fixed', 'ai', 'voluntary'];
  }
}

/** Whether to show task distribution method */
export function shouldShowDistributionMethod(
  arrangement: LivingArrangement | '',
  taskLevel: TaskManagementLevel | ''
): boolean {
  return arrangement !== 'alone' && taskLevel !== 'disabled' && taskLevel !== '';
}

/** Which relationships to suggest per arrangement */
export function getDefaultRelationships(
  arrangement: LivingArrangement | ''
): Relationship[] {
  switch (arrangement) {
    case 'couple':
      return ['partner'];
    case 'family':
      return ['parent', 'sibling', 'child'];
    case 'roommates':
      return ['roommate'];
    default:
      return RELATIONSHIPS.slice() as Relationship[];
  }
}

/** Default age group per arrangement */
export function getDefaultAgeGroup(
  arrangement: LivingArrangement | ''
): AgeGroup {
  switch (arrangement) {
    case 'couple':
    case 'roommates':
      return 'adult';
    default:
      return 'adult';
  }
}

/** Determine UI mode from survey data (mirrors backend logic) */
export function determineUIMode(
  arrangement: LivingArrangement,
  totalMembers: number
): UIMode {
  if (arrangement === 'alone' || totalMembers === 1) return 'solo';
  if (arrangement === 'couple' || totalMembers === 2) return 'couple';
  if (arrangement === 'multi_family') return 'multi_family';
  if (arrangement === 'family') return 'family';
  return 'roommates';
}