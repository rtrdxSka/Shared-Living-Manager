import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';

// ── Types ──────────────────────────────────────────────────────────────────

export type DueDateStatus = 'overdue' | 'due-today' | 'upcoming' | 'none';

// ── Number formatting ──────────────────────────────────────────────────────

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Month helpers ─────────────────────────────────────────────────────────

export function stepMonth(ym: string, dir: 'prev' | 'next'): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, dir === 'prev' ? m - 2 : m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function currentMonthString(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// ── Due date helpers ──────────────────────────────────────────────────────

export function getDueDateStatus(dueDate: string | undefined, isCompleted: boolean): DueDateStatus {
  if (!dueDate || isCompleted) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  return 'upcoming';
}

export function formatDueDate(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due 1 day ago';
  if (diffDays > 1 && diffDays <= 6) return `Due in ${diffDays} days`;
  if (diffDays < -1) return `Due ${Math.abs(diffDays)} days ago`;
  return `Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

// ── Category chip styles ──────────────────────────────────────────────────

export const CATEGORY_CHIP_CLASSES: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  utilities: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  groceries: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  internet: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  cleaning: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  subscriptions: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
};

export const GOAL_CATEGORY_CHIP: Record<string, string> = {
  savings: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  travel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  home: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
};

// ── Goal progress helpers ─────────────────────────────────────────────────

export interface GoalProgressInfo {
  /** Uncapped percentage rounded to integer. May exceed 100. */
  pct: number;
  /** Bar fill percent, capped at 100. */
  capped: number;
  /** Amount by which currentAmount exceeds targetAmount. Zero if not exceeded. */
  overflowAmount: number;
}

export function computeGoalProgress(currentAmount: number, targetAmount: number): GoalProgressInfo {
  if (targetAmount <= 0) {
    return { pct: 0, capped: 0, overflowAmount: 0 };
  }
  const raw = (currentAmount / targetAmount) * 100;
  const pct = Math.round(raw);
  const capped = Math.min(pct, 100);
  const overflowAmount = currentAmount > targetAmount ? currentAmount - targetAmount : 0;
  return { pct, capped, overflowAmount };
}

// ── Split helpers ─────────────────────────────────────────────────────────

export function deriveIncomeSplit(
  household: HouseholdResponse,
  currentUserId: string
): { myPct: number; partnerPct: number } | null {
  const financialMembers = household.members.filter((m) => m.participatesInFinances && m.userId);
  const allHaveIncome = financialMembers.every((m) => m.monthlyIncome !== undefined);
  if (!allHaveIncome || financialMembers.length === 0) return null;

  const total = financialMembers.reduce((s, m) => s + (m.monthlyIncome ?? 0), 0);
  if (total === 0) return null;

  const me = financialMembers.find((m) => m.userId === currentUserId);
  if (!me) return null;

  const myPct = Math.round(((me.monthlyIncome ?? 0) / total) * 100);
  return { myPct, partnerPct: 100 - myPct };
}

/**
 * Per-user view of the couple custom split. `customSplitPercentage` stores the
 * OWNER's share (the backend's custom branch assigns it to the `role: 'owner'`
 * member), so a non-owner viewer's own share is the complement. Mirrors
 * `deriveIncomeSplit` so every consumer can read its own correct percentage.
 *
 * Falls back to 50/50 when no owner can be identified — the backend's custom
 * branch does the same (it splits equally without an owner).
 */
export function deriveCustomSplit(
  household: HouseholdResponse,
  currentUserId: string
): { myPct: number; partnerPct: number } {
  const stored = household.settings.customSplitPercentage ?? 50;
  const owner = household.members.find((m) => m.role === 'owner');
  if (!owner) return { myPct: 50, partnerPct: 50 };
  const iAmOwner = owner.userId === currentUserId;
  const myPct = iAmOwner ? stored : 100 - stored;
  return { myPct, partnerPct: 100 - myPct };
}

/**
 * The current user's share for an expense, read from its frozen `debtorStates`
 * snapshot: a debtor's recorded share, or (for the payer) the amount minus the
 * sum of debtor shares, or 0 for a non-participant. Used for RESOLVED expenses
 * so their shares never drift when the household split changes later.
 */
export function myShareFromDebtorStates(
  expense: Pick<ExpenseResponse, 'amount' | 'paidByUserId' | 'debtorStates'>,
  currentUserId: string
): number {
  const ds = expense.debtorStates ?? [];
  const mine = ds.find((d) => d.userId === currentUserId);
  if (mine) return mine.share;
  if (expense.paidByUserId && expense.paidByUserId === currentUserId) {
    const debtorTotal = ds.reduce((s, d) => s + d.share, 0);
    return Math.round((expense.amount - debtorTotal) * 100) / 100;
  }
  return 0;
}

export function getMyShareLabel(
  expense: ExpenseResponse,
  splitMethod: string,
  customMyPct: number,
  incomeSplit: { myPct: number; partnerPct: number } | null,
  currency: string,
  myNickname: string,
  currentUserId: string
): string {
  const { amount } = expense;
  if (expense.isFullRepayment) {
    if (!expense.paidByNickname) return `Full repayment (payer not set)`;
    const myShare = expense.paidByNickname === myNickname ? 0 : amount;
    return `Your share: ${myShare.toFixed(2)} ${currency} (full repayment)`;
  }
  // Resolved expenses are immutable records — read the frozen snapshot rather
  // than recomputing from the (mutable) current split.
  if (expense.isResolved) {
    const share = myShareFromDebtorStates(expense, currentUserId);
    return `Your share: ${share.toFixed(2)} ${currency}`;
  }
  if (splitMethod === 'equal') {
    return `Your share: ${(amount / 2).toFixed(2)} ${currency}`;
  }
  if (splitMethod === 'income_based' && incomeSplit) {
    const pct = incomeSplit.myPct;
    return `Your share: ${((amount * pct) / 100).toFixed(2)} ${currency} (${pct}%)`;
  }
  if (splitMethod === 'income_based') {
    return 'Income data incomplete';
  }
  return `Your share: ${((amount * customMyPct) / 100).toFixed(2)} ${currency} (${customMyPct}%)`;
}

export function getBalanceSplitLabel(
  splitMethod: string,
  customMyPct: number,
  incomeSplit: { myPct: number; partnerPct: number } | null
): string {
  if (splitMethod === 'equal') return '50/50 equal split';
  if (splitMethod === 'income_based' && incomeSplit) {
    return `${incomeSplit.myPct}/${incomeSplit.partnerPct} income-based split`;
  }
  if (splitMethod === 'income_based') return 'income-based split (data incomplete)';
  return `${customMyPct}/${100 - customMyPct} custom split`;
}
