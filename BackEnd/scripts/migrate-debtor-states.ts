import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { Expense } from '../src/models/expense.model';
import { Household } from '../src/models/household.model';
import {
  computeDebtorShares,
  type SplitMethod,
  type ComputeDebtorSharesParticipant,
} from '../src/utils/computeDebtorShares';

interface MigrationStats {
  scanned: number;
  migrated: number;
  skipped: number;
}

/**
 * Idempotent backfill: converts legacy single-debtor expense state into the new
 * `debtorStates` array. Expenses that already carry a non-empty `debtorStates`
 * are skipped — the script can be safely re-run.
 *
 * For each unmigrated expense:
 *   1. Compute `debtorStates` from the household's `expenseSplitMethod` + members.
 *   2. Carry over the legacy state into the matching entry:
 *      - `pendingConfirmationByUserId + pendingConfirmationAt` → `claimedAt`
 *      - `isResolved + resolvedByUserId + resolvedAt`         → `confirmedAt`
 *      - `lastDisputedAt` (heuristic: attach to the last claimant) → `disputedAt`
 *   3. `$unset` the removed legacy fields.
 */
export async function migrateDebtorStates(): Promise<MigrationStats> {
  const stats: MigrationStats = { scanned: 0, migrated: 0, skipped: 0 };

  const collection = Expense.collection;
  const cursor = collection.find({});

  for await (const doc of cursor) {
    stats.scanned += 1;

    if (Array.isArray(doc.debtorStates) && doc.debtorStates.length > 0) {
      stats.skipped += 1;
      continue;
    }

    const household = await Household.findById(doc.householdId).lean();
    if (!household || !household.members) {
      stats.skipped += 1;
      continue;
    }

    const autoResolveByMode =
      household.settings?.financeMode === 'joint' || household.uiMode === 'solo';

    let newDebtorStates: Array<{
      userId: Types.ObjectId;
      share: number;
      claimedAt?: Date;
      confirmedAt?: Date;
      disputedAt?: Date;
    }> = [];

    if (!autoResolveByMode && doc.paidByUserId) {
      const splitMethod = (household.settings?.expenseSplitMethod ?? 'equal') as SplitMethod;
      const participants: ComputeDebtorSharesParticipant[] = household.members
        .filter((m) => m.participatesInFinances && m.userId)
        .map((m) => ({
          userId: m.userId as Types.ObjectId,
          monthlyIncome: m.monthlyIncome ?? undefined,
          role: m.role,
        }));

      const participantUserIdSet = Array.isArray(doc.participantUserIds)
        ? new Set((doc.participantUserIds as Types.ObjectId[]).map((id) => id.toString()))
        : null;
      const effectiveParticipants = participantUserIdSet
        ? participants.filter((p) => participantUserIdSet.has(p.userId.toString()))
        : participants;

      const shares = computeDebtorShares({
        amount: doc.amount as number,
        payerUserId: doc.paidByUserId as Types.ObjectId,
        participants: effectiveParticipants,
        splitMethod,
        customSplitOverrides: doc.customSplitOverrides as
          | { userId: Types.ObjectId; pct: number }[]
          | undefined,
        customSplitPercentage: household.settings?.customSplitPercentage,
        isFullRepayment: doc.isFullRepayment as boolean | undefined,
      });

      newDebtorStates = shares.map((s) => ({
        userId: s.userId,
        share: Math.round(s.share * 100) / 100,
      }));

      // Carry over the legacy resolution state into the matching entry.
      const pendingByUserId = doc.pendingConfirmationByUserId as Types.ObjectId | undefined;
      const pendingAt = doc.pendingConfirmationAt as Date | undefined;
      const resolvedAt = doc.resolvedAt as Date | undefined;
      const resolvedByUserId = doc.resolvedByUserId as Types.ObjectId | undefined;
      const lastDisputedAt = doc.lastDisputedAt as Date | undefined;

      for (const entry of newDebtorStates) {
        if (pendingByUserId && entry.userId.toString() === pendingByUserId.toString()) {
          if (pendingAt) entry.claimedAt = pendingAt;
        }
        if (doc.isResolved && resolvedByUserId && entry.userId.toString() === resolvedByUserId.toString()) {
          if (resolvedAt) entry.confirmedAt = resolvedAt;
        }
        if (lastDisputedAt && pendingByUserId && entry.userId.toString() === pendingByUserId.toString()) {
          entry.disputedAt = lastDisputedAt;
        }
      }
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: { debtorStates: newDebtorStates },
        $unset: {
          pendingConfirmation: '',
          pendingConfirmationAt: '',
          pendingConfirmationByUserId: '',
          lastDisputedAt: '',
          resolvedByUserId: '',
        },
      }
    );
    stats.migrated += 1;
  }

  return stats;
}

// CLI entry: `pnpm tsx scripts/migrate-debtor-states.ts`.
if (require.main === module) {
  (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is required to run this migration.');
      process.exit(1);
    }
    await mongoose.connect(uri);
    const stats = await migrateDebtorStates();
    console.log('Migration complete:', stats);
    await mongoose.disconnect();
  })();
}
