import type { IExpense } from '../types/expense.types';
import type { IHousehold, IHouseholdMember } from '../types/household.types';

/**
 * Per-member economic attribution for a single expense.
 *
 *  - `share`  → the member's effective economic burden for this expense.
 *               Undefined when the household is in joint finance mode
 *               (no individual attribution is meaningful).
 *  - `paid`   → the cash outlay this member made for this expense. Always
 *               present; 0 for members who did not pay.
 */
export interface MemberAttribution {
  share?: number;
  paid: number;
}

type ExpenseLike = Pick<
  IExpense,
  'amount' | 'paidByUserId' | 'isFullRepayment' | 'isResolved' | 'debtorStates'
>;
type HouseholdLike = Pick<IHousehold, 'settings' | 'members'>;

/**
 * Compute each participating member's share + paid amount for a single
 * expense. Pure function — no DB access, no logging.
 *
 * Members where `participatesInFinances === false` are excluded from the
 * returned map entirely.
 *
 * Keys in the returned map are the member subdocument `_id` as string
 * (NOT userId).
 */
export function computeMemberAttributionsForExpense(
  expense: ExpenseLike,
  household: HouseholdLike
): Map<string, MemberAttribution> {
  const result = new Map<string, MemberAttribution>();
  const participating: IHouseholdMember[] = household.members.filter(
    (m) => m.participatesInFinances !== false
  );

  if (participating.length === 0) return result;

  const amount = expense.amount;
  const payerUserId = expense.paidByUserId?.toString();
  const financeMode = household.settings.financeMode;
  const splitMethod = household.settings.expenseSplitMethod;
  const customPct = household.settings.customSplitPercentage;

  // Seed the map with paid amounts and (where applicable) a placeholder
  // share that we'll overwrite below per split method.
  for (const member of participating) {
    const paid =
      member.userId?.toString() === payerUserId && payerUserId
        ? amount
        : 0;
    result.set(member._id.toString(), { paid });
  }

  // Joint mode: no individual share attribution; leave `share` undefined.
  if (financeMode === 'joint') {
    return result;
  }

  // Full repayment: non-payer owes the full amount, payer owes nothing.
  // Works for any N ≥ 2; in a couple it's the natural "you owe the whole
  // thing back".
  if (expense.isFullRepayment === true) {
    for (const member of participating) {
      const isPayer =
        member.userId?.toString() === payerUserId && !!payerUserId;
      const entry = result.get(member._id.toString())!;
      entry.share = isPayer ? 0 : amount;
    }
    return result;
  }

  // Resolved expenses are immutable records: derive each member's share from the
  // frozen `debtorStates` snapshot (the split in effect when it was settled), not
  // from the household's current settings. Unresolved expenses fall through to
  // the live computation below, so they still track the current split.
  if (expense.isResolved === true) {
    const shareByUserId = new Map<string, number>();
    let debtorTotal = 0;
    for (const d of expense.debtorStates ?? []) {
      const uid = d.userId?.toString();
      if (!uid) continue;
      shareByUserId.set(uid, d.share);
      debtorTotal += d.share;
    }
    // The payer absorbs everything not owed by a debtor (and any cent-rounding).
    const payerResidual = Math.round((amount - debtorTotal) * 100) / 100;
    for (const member of participating) {
      const uid = member.userId?.toString();
      const entry = result.get(member._id.toString())!;
      if (uid && uid === payerUserId) {
        entry.share = payerResidual;
      } else if (uid && shareByUserId.has(uid)) {
        entry.share = shareByUserId.get(uid)!;
      } else {
        // Not the payer and not a recorded debtor → not a participant of this
        // (possibly subgroup) expense.
        entry.share = 0;
      }
    }
    return result;
  }

  const N = participating.length;
  const equalShare = (): void => {
    const per = amount / N;
    for (const member of participating) {
      result.get(member._id.toString())!.share = per;
    }
  };

  // Income-based: weight share by each member's monthly income. Falls back
  // to equal if any participating member lacks `monthlyIncome` or the sum
  // is 0.
  if (splitMethod === 'income_based') {
    const incomes = participating.map((m) => m.monthlyIncome);
    const anyMissing = incomes.some(
      (inc) => inc === undefined || inc === null
    );
    const total = anyMissing
      ? 0
      : (incomes as number[]).reduce((acc, n) => acc + n, 0);

    if (anyMissing || total <= 0) {
      equalShare();
      return result;
    }

    for (const member of participating) {
      const inc = member.monthlyIncome as number;
      result.get(member._id.toString())!.share = amount * (inc / total);
    }
    return result;
  }

  // Custom: owner pays customSplitPercentage; the remainder is split
  // equally among non-owners. Falls back to equal if the owner cannot be
  // identified or the percentage is out of [1, 99].
  if (splitMethod === 'custom') {
    const owner = participating.find((m) => m.role === 'owner');
    const pctValid =
      typeof customPct === 'number' && customPct >= 1 && customPct <= 99;

    if (!owner || !pctValid) {
      equalShare();
      return result;
    }

    const ownerShare = amount * (customPct / 100);
    const remainder = amount - ownerShare;
    const nonOwnerCount = N - 1;
    const perNonOwner = nonOwnerCount > 0 ? remainder / nonOwnerCount : 0;

    for (const member of participating) {
      const isOwner = member._id.toString() === owner._id.toString();
      result.get(member._id.toString())!.share = isOwner
        ? ownerShare
        : perNonOwner;
    }
    return result;
  }

  // 'equal', 'usage_based', or any unset/unknown method → split evenly.
  equalShare();
  return result;
}
