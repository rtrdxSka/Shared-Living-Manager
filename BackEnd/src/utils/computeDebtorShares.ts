import { Types } from 'mongoose';

export type SplitMethod = 'equal' | 'income_based' | 'usage_based' | 'custom';

export interface ComputeDebtorSharesParticipant {
  userId: Types.ObjectId;
  monthlyIncome?: number;
  role?: 'owner' | 'admin' | 'member';
}

export interface ComputeDebtorSharesInput {
  amount: number;
  payerUserId: Types.ObjectId;
  participants: ComputeDebtorSharesParticipant[];
  splitMethod: SplitMethod;
  customSplitOverrides?: { userId: Types.ObjectId; pct: number }[];
  customSplitPercentage?: number;
  /**
   * Household-level per-member custom percentages (roommate-style). Covers every
   * finance member and sums to 100. Applied only when `splitMethod === 'custom'`
   * and no per-expense `customSplitOverrides` are present.
   */
  customSplitShares?: { userId: Types.ObjectId; pct: number }[];
  isFullRepayment?: boolean;
}

export interface DebtorShare {
  userId: Types.ObjectId;
  share: number;
}

/**
 * Compute the per-debtor dollar shares for an expense. Returns one entry for
 * every non-payer participant. Solo expenses (no debtors) return [].
 *
 * Resolution order:
 *   1. `isFullRepayment` → every non-payer owes the full amount each
 *   2. per-expense `customSplitOverrides` → use as authoritative percentages
 *   3. `splitMethod === 'income_based'` with usable income data → income-weighted
 *   4. `splitMethod === 'custom'`:
 *      a. household `customSplitShares` that cover every participant → per-member
 *         percentages rescaled proportionally to sum to 100 over the participant
 *         set (roommate-style; a no-op for the full household)
 *      b. else a valid `customSplitPercentage` and an identifiable owner among
 *         participants → owner pays X%, non-owners share the rest equally
 *         (couple-style)
 *      c. else equal
 *   5. fallback → equal split
 */
export function computeDebtorShares(input: ComputeDebtorSharesInput): DebtorShare[] {
  const payerKey = input.payerUserId.toString();
  const debtors = input.participants.filter((p) => p.userId.toString() !== payerKey);
  if (debtors.length === 0) return [];

  // Branch 1 — isFullRepayment: each non-payer owes the full amount.
  if (input.isFullRepayment === true) {
    return debtors.map((d) => ({ userId: d.userId, share: input.amount }));
  }

  // Branch 2 — per-expense customSplitOverrides (roommates style).
  if (input.customSplitOverrides && input.customSplitOverrides.length > 0) {
    const pctByUser = new Map<string, number>();
    for (const o of input.customSplitOverrides) pctByUser.set(o.userId.toString(), o.pct);
    return debtors.map((d) => ({
      userId: d.userId,
      share: (input.amount * (pctByUser.get(d.userId.toString()) ?? 0)) / 100,
    }));
  }

  const N = input.participants.length;
  const equalShare = (): DebtorShare[] => {
    const each = input.amount / N;
    return debtors.map((d) => ({ userId: d.userId, share: each }));
  };

  // Branch 3 — income_based.
  if (input.splitMethod === 'income_based') {
    const anyMissing = input.participants.some(
      (p) => p.monthlyIncome === undefined || p.monthlyIncome === null
    );
    const total = anyMissing
      ? 0
      : input.participants.reduce((acc, p) => acc + (p.monthlyIncome ?? 0), 0);
    if (anyMissing || total <= 0) return equalShare();
    return debtors.map((d) => ({
      userId: d.userId,
      share: input.amount * ((d.monthlyIncome ?? 0) / total),
    }));
  }

  // Branch 4 — custom.
  if (input.splitMethod === 'custom') {
    // 4a — household per-member shares (roommate-style). Apply when they cover
    // every participant, rescaling proportionally over the participant set so the
    // shares sum to 100 (mirrors the form's seedCustomPcts). For the full
    // household rawSum is already 100, so this is a no-op; for a subgroup it
    // preserves each member's relative weight instead of falling back to equal.
    // If a participant has no stored share, fall through (→ couple-style / equal).
    if (input.customSplitShares && input.customSplitShares.length > 0) {
      const pctByUser = new Map<string, number>();
      for (const s of input.customSplitShares) pctByUser.set(s.userId.toString(), s.pct);
      const coversAll = input.participants.every((p) => pctByUser.has(p.userId.toString()));
      const rawSum = input.participants.reduce(
        (acc, p) => acc + (pctByUser.get(p.userId.toString()) ?? 0),
        0
      );
      if (coversAll && rawSum > 0) {
        return debtors.map((d) => ({
          userId: d.userId,
          share: input.amount * ((pctByUser.get(d.userId.toString()) ?? 0) / rawSum),
        }));
      }
    }

    // 4b — couple-style single owner pct on settings.
    const owner = input.participants.find((p) => p.role === 'owner');
    const pctValid =
      typeof input.customSplitPercentage === 'number' &&
      input.customSplitPercentage >= 1 &&
      input.customSplitPercentage <= 99;
    if (!owner || !pctValid) return equalShare();
    const ownerPct = input.customSplitPercentage as number;
    const ownerShare = input.amount * (ownerPct / 100);
    const nonOwnerCount = N - 1;
    const perNonOwner = nonOwnerCount > 0 ? (input.amount - ownerShare) / nonOwnerCount : 0;
    return debtors.map((d) => ({
      userId: d.userId,
      share: d.userId.toString() === owner.userId.toString() ? ownerShare : perNonOwner,
    }));
  }

  // Branch 5 — equal (also covers usage_based and any unknown method).
  return equalShare();
}
