import type { ExpenseResponse } from '@/types/expense.types';

export type SplitMethod = 'equal' | 'income_based' | 'usage_based' | 'custom';

export interface SettlementMember {
  userId: string;
  nickname: string;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
}

export interface IncomeSplit {
  byUserId: Record<string, number /* income share, NOT necessarily summing to 100 */>;
}

/**
 * Pure function that computes net debts from a list of expenses and reduces them
 * to a minimal set of "X owes Y N" transactions via a greedy creditor/debtor pairing.
 *
 * Honors:
 *   - `participantUserIds` (subgroup expenses; falls back to all members)
 *   - `customSplitOverrides` (per-user percentages override the split method)
 *   - `paidByUserId` (expenses with no payer are skipped)
 *   - `isFullRepayment` (mirrors OverviewPage semantics: payer settled on behalf of
 *     the group, so participants owe their share back to the payer; the payer is
 *     NOT credited the full amount as if they had funded the expense)
 *   - `isResolved` (skipped entirely)
 *   - `splitMethod` ('equal' | 'income_based' | 'usage_based' | 'custom')
 */
export function computeSettlement(
  members: SettlementMember[],
  expenses: ExpenseResponse[],
  splitMethod: SplitMethod,
  incomeSplit?: IncomeSplit
): SettlementTransaction[] {
  // Initialize net balance per member to zero.
  const net: Record<string, number> = {};
  for (const m of members) net[m.userId] = 0;

  for (const e of expenses) {
    if (e.isResolved) continue;
    if (!e.paidByUserId) continue;

    const participants =
      e.participantUserIds && e.participantUserIds.length > 0
        ? e.participantUserIds
        : members.map((m) => m.userId);
    if (participants.length === 0) continue;

    // Compute each participant's share.
    const shares: Record<string, number> = {};
    if (e.customSplitOverrides && e.customSplitOverrides.length > 0) {
      for (const o of e.customSplitOverrides) {
        shares[o.userId] = (e.amount * o.pct) / 100;
      }
    } else if (splitMethod === 'income_based' && incomeSplit) {
      const totalIncome = participants.reduce(
        (s, uid) => s + (incomeSplit.byUserId[uid] ?? 0),
        0
      );
      if (totalIncome > 0) {
        for (const uid of participants) {
          shares[uid] = (e.amount * (incomeSplit.byUserId[uid] ?? 0)) / totalIncome;
        }
      } else {
        const each = e.amount / participants.length;
        for (const uid of participants) shares[uid] = each;
      }
    } else {
      const each = e.amount / participants.length;
      for (const uid of participants) shares[uid] = each;
    }

    if (e.isFullRepayment) {
      // Payer is settling on behalf of the group — participants owe their own
      // share back to the payer. (Mirrors OverviewPage's existing semantic.)
      for (const uid of participants) {
        if (uid !== e.paidByUserId) {
          net[uid] = (net[uid] ?? 0) - shares[uid];
          net[e.paidByUserId] = (net[e.paidByUserId] ?? 0) + shares[uid];
        }
      }
    } else {
      net[e.paidByUserId] = (net[e.paidByUserId] ?? 0) + e.amount;
      for (const uid of participants) {
        net[uid] = (net[uid] ?? 0) - shares[uid];
      }
    }
  }

  // Greedy reduction to a minimal set of creditor/debtor transactions.
  const creditors: [string, number][] = Object.entries(net)
    .filter(([, v]) => v > 0.005)
    .sort((a, b) => b[1] - a[1]);
  const debtors: [string, number][] = Object.entries(net)
    .filter(([, v]) => v < -0.005)
    .sort((a, b) => a[1] - b[1]);

  const transactions: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const [cId, cAmt] = creditors[i];
    const [dId, dAmt] = debtors[j];
    const settle = Math.min(cAmt, -dAmt);
    transactions.push({ from: dId, to: cId, amount: Math.round(settle * 100) / 100 });
    creditors[i] = [cId, cAmt - settle];
    debtors[j] = [dId, dAmt + settle];
    if (creditors[i][1] <= 0.005) i++;
    if (debtors[j][1] >= -0.005) j++;
  }

  return transactions;
}
