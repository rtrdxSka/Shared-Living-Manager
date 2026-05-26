import { Types } from 'mongoose';
import { BadRequestError } from '../../utils/error';
import type { IHousehold } from '../../types/household.types';

// ── Subgroup validation helper ─────────────────────────────────────
//
// Returns `null` when no subgroup is configured (the caller should not set
// either field). Returns an object with normalized ObjectId arrays when a
// subgroup is present and valid. Throws BadRequestError on any violation.
//
// Rules enforced:
//  - if customSplitOverrides present, participantUserIds must also be set
//  - every participantUserId must be a finance-participating member
//  - the payer (if provided) must be inside the subgroup
//  - customSplitOverrides userIds must exactly match participantUserIds
//  - each override pct is an integer in 1..99 and they sum to 100
//
// Note: the helper accepts a partial-shape household so it works against
// both lean reads (getHouseholdForMember) and full Mongoose docs.
export function validateParticipantsAndOverrides(
  household: Pick<IHousehold, 'members'>,
  participantUserIds: string[] | undefined | null,
  customSplitOverrides: { userId: string; pct: number }[] | undefined,
  paidByUserId: string | undefined | null
): {
  participantUserIds?: Types.ObjectId[];
  customSplitOverrides?: { userId: Types.ObjectId; pct: number }[];
} | null {
  if (!participantUserIds || participantUserIds.length === 0) {
    if (customSplitOverrides && customSplitOverrides.length > 0) {
      throw BadRequestError('customSplitOverrides requires participantUserIds to be set');
    }
    return null;
  }

  const dedup = Array.from(new Set(participantUserIds));
  const eligibleMembers = household.members.filter(
    (m) => m.userId && m.participatesInFinances
  );
  const eligibleSet = new Set(eligibleMembers.map((m) => m.userId!.toString()));

  for (const uid of dedup) {
    if (!eligibleSet.has(uid)) {
      throw BadRequestError(
        `participantUserId ${uid} is not a finance-participating member of the household`
      );
    }
  }

  if (paidByUserId && !dedup.includes(paidByUserId)) {
    throw BadRequestError('payer is not in the participants subgroup');
  }

  let overridesOut:
    | { userId: Types.ObjectId; pct: number }[]
    | undefined;
  if (customSplitOverrides && customSplitOverrides.length > 0) {
    const overrideIds = customSplitOverrides.map((o) => o.userId);
    const overrideSet = new Set(overrideIds);
    if (overrideSet.size !== overrideIds.length) {
      throw BadRequestError('customSplitOverrides contains duplicate userId entries');
    }
    if (
      overrideSet.size !== dedup.length ||
      !dedup.every((uid) => overrideSet.has(uid))
    ) {
      throw BadRequestError('customSplitOverrides userIds must match participantUserIds exactly');
    }
    for (const o of customSplitOverrides) {
      if (!Number.isInteger(o.pct) || o.pct < 1 || o.pct > 99) {
        throw BadRequestError(
          `customSplitOverrides pct must be an integer 1-99 (got ${o.pct} for ${o.userId})`
        );
      }
    }
    const sum = customSplitOverrides.reduce((s, o) => s + o.pct, 0);
    if (sum !== 100) {
      throw BadRequestError(
        `customSplitOverrides percentages must sum to 100 (got ${sum})`
      );
    }
    overridesOut = customSplitOverrides.map((o) => ({
      userId: new Types.ObjectId(o.userId),
      pct: o.pct,
    }));
  }

  return {
    participantUserIds: dedup.map((uid) => new Types.ObjectId(uid)),
    customSplitOverrides: overridesOut,
  };
}
