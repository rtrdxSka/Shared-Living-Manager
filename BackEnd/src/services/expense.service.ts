import mongoose, { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { Expense } from '../models/expense.model';
import {
  IAddExpenseInput,
  IListExpensesInput,
  IListExpensesResult,
  IExpenseResponse,
  IExpense,
  IExpenseDebtorState,
  IUpdateExpenseInput,
} from '../types/expense.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { clampLimit, encodeDateIdCursor, parseDateIdCursor } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';
import { getHouseholdForMember } from '../utils/household.helpers';
import { validateParticipantsAndOverrides } from './_shared/expense-subgroup';
import {
  computeDebtorShares,
  type SplitMethod,
  type ComputeDebtorSharesParticipant,
} from '../utils/computeDebtorShares';

class ExpenseService {
  async addExpense(
    householdId: string,
    requestingUserId: string,
    input: IAddExpenseInput
  ): Promise<IExpenseResponse> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, requestingUserId);

    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    let payerNickname: string | undefined;
    if (input.paidByUserId) {
      const payerMember = household.members.find(
        (m) => m.userId?.toString() === input.paidByUserId && m.participatesInFinances
      );
      if (!payerMember) {
        throw BadRequestError('paidByUserId does not match a financial household member');
      }
      payerNickname = payerMember.nickname;
    }

    const subgroup = validateParticipantsAndOverrides(
      household,
      input.participantUserIds,
      input.customSplitOverrides,
      input.paidByUserId
    );

    const autoResolveByMode =
      household.settings?.financeMode === 'joint' || household.uiMode === 'solo';
    const now = new Date();

    // Build per-debtor states. Only meaningful in split mode with a known payer.
    let debtorStates: IExpenseDebtorState[] = [];
    if (!autoResolveByMode && input.paidByUserId) {
      const splitMethod = (household.settings?.expenseSplitMethod ?? 'equal') as SplitMethod;
      const allFinancialParticipants: ComputeDebtorSharesParticipant[] = household.members
        .filter((m) => m.participatesInFinances && m.userId)
        .map((m) => ({
          userId: m.userId as Types.ObjectId,
          monthlyIncome: m.monthlyIncome ?? undefined,
          role: m.role,
        }));

      // If a subgroup was provided, filter participants accordingly.
      const participantUserIdSet = subgroup?.participantUserIds
        ? new Set(subgroup.participantUserIds.map((id) => id.toString()))
        : null;
      const participants = participantUserIdSet
        ? allFinancialParticipants.filter((p) => participantUserIdSet.has(p.userId.toString()))
        : allFinancialParticipants;

      const shares = computeDebtorShares({
        amount: input.amount,
        payerUserId: new Types.ObjectId(input.paidByUserId),
        participants,
        splitMethod,
        customSplitOverrides: subgroup?.customSplitOverrides,
        customSplitPercentage: household.settings?.customSplitPercentage,
        customSplitShares: household.settings?.customSplitShares?.map((s) => ({
          userId: new Types.ObjectId(s.userId),
          pct: s.pct,
        })),
        isFullRepayment: input.isFullRepayment,
      });

      debtorStates = shares.map((s) => ({
        userId: s.userId,
        share: Math.round(s.share * 100) / 100,
      })) as IExpenseDebtorState[];
    }

    const hasPayer = !!input.paidByUserId;
    const isResolved =
      autoResolveByMode ||
      (hasPayer && debtorStates.length === 0);

    const expense = await Expense.create({
      householdId: household._id,
      ...(input.paidByUserId && { paidByUserId: input.paidByUserId }),
      createdByUserId: requestingUserId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      date: new Date(input.date),
      ...(input.notes && { notes: input.notes }),
      isFullRepayment: input.isFullRepayment ?? false,
      isResolved,
      ...(isResolved && { resolvedAt: now }),
      ...(subgroup?.participantUserIds && { participantUserIds: subgroup.participantUserIds }),
      ...(subgroup?.customSplitOverrides && { customSplitOverrides: subgroup.customSplitOverrides }),
      debtorStates,
    });

    return this.formatExpenseResponse(expense, payerNickname);
  }

  async listExpenses(
    householdId: string,
    requestingUserId: string,
    input: IListExpensesInput
  ): Promise<IListExpensesResult> {
    const { household } = await getHouseholdForMember(householdId, requestingUserId);

    const limit = clampLimit(input.limit);

    const query: Record<string, unknown> = {
      householdId: household._id,
    };

    if (input.month !== 'all') {
      const { start, end } = this.buildMonthRange(input.month);
      query.date = { $gte: start, $lt: end };
    }

    if (input.search && input.search.trim().length > 0) {
      query.description = { $regex: escapeRegex(input.search.trim()), $options: 'i' };
    }

    if (input.categories && input.categories.length > 0) {
      query.category = { $in: input.categories };
    }

    if (input.paidBy && input.paidBy.length > 0) {
      query.paidByUserId = { $in: input.paidBy.map((id) => new Types.ObjectId(id)) };
    }

    if (input.status === 'unresolved') {
      query.isResolved = false;
      query.debtorStates = {
        $not: { $elemMatch: { claimedAt: { $exists: true }, confirmedAt: { $exists: false } } },
      };
    } else if (input.status === 'pending') {
      query.isResolved = false;
      query.debtorStates = {
        $elemMatch: { claimedAt: { $exists: true }, confirmedAt: { $exists: false } },
      };
    } else if (input.status === 'resolved') {
      query.isResolved = true;
    }

    if (input.cursor) {
      const c = parseDateIdCursor(input.cursor);
      query.$or = [
        { date: { $lt: c.date } },
        { date: c.date, _id: { $lt: new Types.ObjectId(c.id) } },
      ];
    }

    const expenses = await Expense.find(query)
      .sort({ date: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = expenses.length > limit;
    const pageItems = expenses.slice(0, limit);

    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    const items = pageItems.map((expense) => this.formatExpenseResponse(expense, nicknameMap));

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeDateIdCursor(last.date, last._id);
    }

    return { items, nextCursor };
  }

  private buildMonthRange(month?: string): { start: Date; end: Date } {
    let year: number, monthIndex: number;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthIndex = m - 1;
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIndex = now.getUTCMonth();
    }
    return {
      start: new Date(Date.UTC(year, monthIndex, 1)),
      end: new Date(Date.UTC(year, monthIndex + 1, 1)),
    };
  }

  async deleteExpense(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<void> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, requestingUserId);
    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) {
      throw NotFoundError('Expense not found');
    }

    if (expense.isResolved) {
      throw BadRequestError('Cannot delete a resolved expense');
    }

    const isAdminOrOwner =
      requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isCreator = expense.createdByUserId.toString() === requestingUserId;
    if (!isCreator && !isAdminOrOwner) {
      throw ForbiddenError('You can only delete expenses you created');
    }

    await expense.deleteOne();
  }

  async updateExpense(
    householdId: string,
    requestingUserId: string,
    expenseId: string,
    input: IUpdateExpenseInput
  ): Promise<IExpenseResponse> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, requestingUserId);
    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) {
      throw NotFoundError('Expense not found');
    }

    if (expense.isResolved) {
      throw BadRequestError('Cannot modify a resolved expense');
    }

    if (expense.createdByUserId.toString() !== requestingUserId) {
      throw ForbiddenError('You can only edit expenses you created');
    }

    if (input.description !== undefined) expense.description = input.description;
    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.category !== undefined) expense.category = input.category;
    if (input.date !== undefined) expense.date = new Date(input.date);
    if (input.notes !== undefined) expense.notes = input.notes;
    if (input.isFullRepayment !== undefined) expense.isFullRepayment = input.isFullRepayment;
    if (input.paidByUserId !== undefined) {
      if (input.paidByUserId === null) {
        expense.paidByUserId = undefined;
      } else {
        const payerMember = household.members.find(
          (m) => m.userId?.toString() === input.paidByUserId && m.participatesInFinances
        );
        if (!payerMember) {
          throw BadRequestError('paidByUserId does not match a financial household member');
        }
        expense.paidByUserId = input.paidByUserId as unknown as typeof expense.paidByUserId;
      }
    }

    const subgroupTouched =
      input.participantUserIds !== undefined ||
      input.customSplitOverrides !== undefined;
    if (subgroupTouched) {
      const clearing =
        input.participantUserIds === null ||
        (Array.isArray(input.participantUserIds) && input.participantUserIds.length === 0);
      if (clearing) {
        if (input.customSplitOverrides && input.customSplitOverrides.length > 0) {
          throw BadRequestError(
            'customSplitOverrides requires participantUserIds to be set'
          );
        }
        expense.participantUserIds = undefined;
        expense.customSplitOverrides = undefined;
      } else {
        const effectiveParticipants =
          input.participantUserIds ??
          expense.participantUserIds?.map((id) => id.toString());
        const effectivePayer =
          input.paidByUserId !== undefined
            ? input.paidByUserId ?? undefined
            : expense.paidByUserId?.toString();
        const subgroup = validateParticipantsAndOverrides(
          household,
          effectiveParticipants,
          input.customSplitOverrides,
          effectivePayer
        );
        if (subgroup?.participantUserIds) {
          expense.participantUserIds = subgroup.participantUserIds;
        }
        if (input.customSplitOverrides !== undefined) {
          expense.customSplitOverrides = subgroup?.customSplitOverrides;
        }
      }
    }

    await expense.save();

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap);
  }

  async claimExpense(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not track per-user claims');
    }

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === requestingUserId && m.participatesInFinances
    );
    if (!requesterMember || !requesterMember.userId) {
      throw ForbiddenError('You must be a financial member to claim an expense');
    }

    const session = await mongoose.startSession();
    let expense: mongoose.HydratedDocument<IExpense> | null = null;
    try {
      // `withTransaction` retries the body on TransientTransactionError /
      // UnknownTransactionCommitResult (e.g. MongoDB WriteConflict between
      // two parallel claimExpense calls touching the same document). The
      // body must therefore be idempotent: on retry the loser will see the
      // winning payer already set and fall through to the BadRequest branch.
      await session.withTransaction(async () => {
        // Atomically claim the expense by setting paidByUserId only if no payer
        // is set yet. Under concurrent claims, exactly one caller wins and the
        // other gets BadRequest below.
        expense = await Expense.findOneAndUpdate(
          {
            _id: expenseId,
            householdId: household._id,
            $or: [{ paidByUserId: { $exists: false } }, { paidByUserId: null }],
          },
          { $set: { paidByUserId: requesterMember.userId } },
          { new: true, session },
        );

        if (!expense) {
          // Determine 404 vs 400 BEFORE the throw aborts the transaction.
          const exists = await Expense.exists({ _id: expenseId, householdId: household._id }).session(session);
          if (!exists) throw NotFoundError('Expense not found');
          throw BadRequestError('This expense has already been claimed');
        }

        // Capture into a non-null local so TS narrows correctly across nested closures.
        const claimed = expense;

        // We won the claim — compute debtorStates now that we know the payer.
        // Mirrors addExpense (lines 59-93) so debtors get the same per-share
        // entries they would have had if the expense had been created with a
        // payer from the start.
        const splitMethod = (household.settings?.expenseSplitMethod ?? 'equal') as SplitMethod;
        const allFinancialParticipants: ComputeDebtorSharesParticipant[] = household.members
          .filter((m) => m.participatesInFinances && m.userId)
          .map((m) => ({
            userId: m.userId as Types.ObjectId,
            monthlyIncome: m.monthlyIncome ?? undefined,
            role: m.role,
          }));

        const participantUserIdSet = claimed.participantUserIds?.length
          ? new Set(claimed.participantUserIds.map((id) => id.toString()))
          : null;
        const participants = participantUserIdSet
          ? allFinancialParticipants.filter((p) => participantUserIdSet.has(p.userId.toString()))
          : allFinancialParticipants;

        const shares = computeDebtorShares({
          amount: claimed.amount,
          payerUserId: requesterMember.userId as Types.ObjectId,
          participants,
          splitMethod,
          customSplitOverrides: claimed.customSplitOverrides?.map((o) => ({
            userId: o.userId as Types.ObjectId,
            pct: o.pct,
          })),
          customSplitPercentage: household.settings?.customSplitPercentage,
          customSplitShares: household.settings?.customSplitShares?.map((s) => ({
            userId: new Types.ObjectId(s.userId),
            pct: s.pct,
          })),
          isFullRepayment: claimed.isFullRepayment,
        });

        const now = new Date();
        claimed.debtorStates = shares.map((s) => ({
          userId: s.userId,
          share: Math.round(s.share * 100) / 100,
        })) as typeof claimed.debtorStates;

        // No debtors (e.g. solo household) → nothing to settle, mark resolved.
        // Same rule as addExpense's isResolved condition.
        if (claimed.debtorStates.length === 0) {
          claimed.isResolved = true;
          claimed.resolvedAt = now;
        }

        await claimed.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense!, nicknameMap);
  }

  async claimPayback(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');
    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the payback flow');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let expense;
    try {
      expense = await Expense.findOne({ _id: expenseId, householdId: household._id }).session(session);
      if (!expense) {
        await session.abortTransaction();
        throw NotFoundError('Expense not found');
      }
      if (expense.isResolved) {
        await session.abortTransaction();
        throw BadRequestError('This expense is already resolved');
      }
      const entry = expense.debtorStates.find((d) => d.userId.toString() === requestingUserId);
      if (!entry) {
        await session.abortTransaction();
        throw ForbiddenError('Only debtors on this expense can claim payback');
      }
      if (entry.confirmedAt) {
        await session.abortTransaction();
        throw BadRequestError('Your share is already settled');
      }
      entry.claimedAt = new Date();
      entry.disputedAt = undefined;
      expense.markModified('debtorStates');
      await expense.save({ session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap);
  }

  async confirmPayback(
    householdId: string,
    requestingUserId: string,
    expenseId: string,
    input: { debtorUserId: string }
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');
    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the payback flow');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let expense;
    try {
      expense = await Expense.findOne({ _id: expenseId, householdId: household._id }).session(session);
      if (!expense) {
        await session.abortTransaction();
        throw NotFoundError('Expense not found');
      }
      if (!expense.paidByUserId) {
        await session.abortTransaction();
        throw BadRequestError('Expense has no payer');
      }
      if (expense.paidByUserId.toString() !== requestingUserId) {
        await session.abortTransaction();
        throw ForbiddenError('Only the payer can confirm payback');
      }

      const entry = expense.debtorStates.find((d) => d.userId.toString() === input.debtorUserId);
      if (!entry) {
        await session.abortTransaction();
        throw BadRequestError('Not a debtor on this expense');
      }
      if (entry.confirmedAt) {
        await session.abortTransaction();
        throw BadRequestError('This debtor is already settled');
      }
      if (!entry.claimedAt) {
        await session.abortTransaction();
        throw BadRequestError('No pending claim from this debtor');
      }

      const now = new Date();
      entry.confirmedAt = now;

      if (expense.debtorStates.every((d) => d.confirmedAt)) {
        expense.isResolved = true;
        const maxConfirmed = expense.debtorStates.reduce<Date | null>((max, d) => {
          const ts = d.confirmedAt as Date;
          return !max || ts > max ? ts : max;
        }, null);
        if (maxConfirmed) expense.resolvedAt = maxConfirmed;
      }

      expense.markModified('debtorStates');
      await expense.save({ session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap);
  }

  async disputePayback(
    householdId: string,
    requestingUserId: string,
    expenseId: string,
    input: { debtorUserId: string }
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');
    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the payback flow');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let expense;
    try {
      expense = await Expense.findOne({ _id: expenseId, householdId: household._id }).session(session);
      if (!expense) {
        await session.abortTransaction();
        throw NotFoundError('Expense not found');
      }
      if (!expense.paidByUserId) {
        await session.abortTransaction();
        throw BadRequestError('Expense has no payer');
      }
      if (expense.paidByUserId.toString() !== requestingUserId) {
        await session.abortTransaction();
        throw ForbiddenError('Only the payer can dispute a payback claim');
      }

      const entry = expense.debtorStates.find((d) => d.userId.toString() === input.debtorUserId);
      if (!entry) {
        await session.abortTransaction();
        throw BadRequestError('Not a debtor on this expense');
      }
      if (!entry.claimedAt) {
        await session.abortTransaction();
        throw BadRequestError('No pending claim to dispute from this debtor');
      }

      entry.claimedAt = undefined;
      entry.disputedAt = new Date();
      expense.markModified('debtorStates');
      await expense.save({ session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap);
  }

  async assertExpenseInHousehold(householdId: string, expenseId: string): Promise<void> {
    const exists = await Expense.exists({ _id: expenseId, householdId });
    if (!exists) throw NotFoundError('Expense not found in this household');
  }

  async autoConfirmExpiredPending(): Promise<number> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const now = new Date();

    // Pass 1 — confirm every expired-pending entry in-place via arrayFilters.
    // Targets only unresolved expenses that contain at least one entry whose
    // claimedAt is past the cutoff and which has no confirmedAt yet.
    const pass1 = await Expense.updateMany(
      {
        isResolved: false,
        debtorStates: {
          $elemMatch: { claimedAt: { $lt: cutoff }, confirmedAt: { $exists: false } },
        },
      },
      { $set: { 'debtorStates.$[entry].confirmedAt': now } },
      {
        arrayFilters: [
          { 'entry.claimedAt': { $lt: cutoff }, 'entry.confirmedAt': { $exists: false } },
        ],
      }
    );

    // Pass 2 — flip isResolved=true on every expense whose every entry now has
    // a confirmedAt. resolvedAt = max(confirmedAt) computed in-pipeline.
    const pass2 = await Expense.updateMany(
      {
        isResolved: false,
        'debtorStates.0': { $exists: true },
        debtorStates: { $not: { $elemMatch: { confirmedAt: { $exists: false } } } },
      },
      [{ $set: { isResolved: true, resolvedAt: { $max: '$debtorStates.confirmedAt' } } }],
      { updatePipeline: true }
    );

    return (pass1.modifiedCount ?? 0) + (pass2.modifiedCount ?? 0);
  }

  private buildNicknameMap(members: Array<{ userId?: { toString(): string } | null; nickname: string }>): Map<string, string> {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.userId) map.set(m.userId.toString(), m.nickname);
    }
    return map;
  }

  formatExpenseResponse(
    expense: IExpense,
    nicknameMapOrName?: Map<string, string> | string,
    _callerUserId?: string
  ): IExpenseResponse {
    const paidByNickname =
      typeof nicknameMapOrName === 'string'
        ? nicknameMapOrName
        : nicknameMapOrName && expense.paidByUserId
        ? nicknameMapOrName.get(expense.paidByUserId.toString())
        : undefined;

    const nicknameMap = nicknameMapOrName instanceof Map ? nicknameMapOrName : undefined;

    return {
      _id: expense._id.toString(),
      householdId: expense.householdId.toString(),
      ...(expense.paidByUserId && { paidByUserId: expense.paidByUserId.toString() }),
      ...(paidByNickname && { paidByNickname }),
      createdByUserId: expense.createdByUserId?.toString() ?? '',
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date.toISOString(),
      ...(expense.notes && { notes: expense.notes }),
      ...(expense.recurringExpenseId && { recurringExpenseId: expense.recurringExpenseId.toString() }),
      isResolved: expense.isResolved ?? false,
      isFullRepayment: expense.isFullRepayment ?? false,
      ...(expense.resolvedAt && { resolvedAt: expense.resolvedAt.toISOString() }),
      ...(expense.participantUserIds && expense.participantUserIds.length > 0 && {
        participantUserIds: expense.participantUserIds.map((id) => id.toString()),
      }),
      ...(expense.customSplitOverrides && expense.customSplitOverrides.length > 0 && {
        customSplitOverrides: expense.customSplitOverrides.map((o) => ({
          userId: o.userId.toString(),
          pct: o.pct,
        })),
      }),
      debtorStates: (expense.debtorStates ?? []).map((d) => ({
        userId: d.userId.toString(),
        ...(nicknameMap && nicknameMap.get(d.userId.toString())
          ? { nickname: nicknameMap.get(d.userId.toString()) }
          : {}),
        share: d.share,
        ...(d.claimedAt && { claimedAt: d.claimedAt.toISOString() }),
        ...(d.confirmedAt && { confirmedAt: d.confirmedAt.toISOString() }),
        ...(d.disputedAt && { disputedAt: d.disputedAt.toISOString() }),
      })),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}

export const expenseService = new ExpenseService();
