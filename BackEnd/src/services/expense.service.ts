import { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { Expense } from '../models/expense.model';
import {
  IAddExpenseInput,
  IListExpensesInput,
  IListExpensesResult,
  IExpenseResponse,
  IExpense,
  IUpdateExpenseInput,
} from '../types/expense.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { clampLimit, encodeDateIdCursor, parseDateIdCursor } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';
import { getHouseholdForMember } from '../utils/household.helpers';

class ExpenseService {
  async addExpense(
    householdId: string,
    requestingUserId: string,
    input: IAddExpenseInput
  ): Promise<IExpenseResponse> {
    // 1. Find household + verify requester is a member
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, requestingUserId);

    // 2. Verify requester is a financial member
    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    // 3. Optionally verify payer when provided
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

    // 4. Create expense
    const autoResolve =
      household.settings?.financeMode === 'joint' || household.uiMode === 'solo';
    const now = new Date();

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
      ...(autoResolve && {
        isResolved: true,
        resolvedAt: now,
        // resolvedByUserId intentionally NOT set — absence marks auto-resolution.
      }),
    });

    // 5. Return formatted response
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
      query.pendingConfirmation = false;
    } else if (input.status === 'pending') {
      query.isResolved = false;
      query.pendingConfirmation = true;
    } else if (input.status === 'resolved') {
      query.isResolved = true;
    }

    if (input.cursor) {
      const c = parseDateIdCursor(input.cursor);
      // Tiebreak by _id when dates collide so two items with the same `date`
      // don't get returned twice across pages.
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
    // Date.UTC avoids local server timezone — rolls over correctly
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

    if (expense.createdByUserId.toString() !== requestingUserId) {
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

    // Joint accounts don't use the claim flow — money came from a shared pot.
    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not track per-user claims');
    }

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === requestingUserId && m.participatesInFinances
    );
    if (!requesterMember) {
      throw ForbiddenError('You must be a financial member to claim an expense');
    }

    // Atomic conditional update — only succeeds if paidByUserId is currently unset.
    // Two parallel requests both pass their filter; only the first $set wins; the
    // second sees a different document state and findOneAndUpdate returns null.
    const expense = await Expense.findOneAndUpdate(
      {
        _id: expenseId,
        householdId: household._id,
        $or: [{ paidByUserId: { $exists: false } }, { paidByUserId: null }],
      },
      { $set: { paidByUserId: requesterMember.userId } },
      { new: true },
    );

    if (!expense) {
      // Disambiguate not-found vs already-claimed.
      const exists = await Expense.exists({ _id: expenseId, householdId: household._id });
      if (!exists) throw NotFoundError('Expense not found');
      throw BadRequestError('This expense has already been claimed');
    }

    return this.formatExpenseResponse(expense, requesterMember.nickname);
  }

  async requestResolution(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the claim/resolve flow');
    }

    const isMember = household.members.some(
      (m) => m.userId?.toString() === requestingUserId && m.participatesInFinances
    );
    if (!isMember) throw ForbiddenError('You must be a financial member to request resolution');

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) throw NotFoundError('Expense not found');
    if (!expense.paidByUserId) throw BadRequestError('Cannot request resolution on an unclaimed expense');
    if (expense.isResolved) throw BadRequestError('This expense is already resolved');
    if (expense.paidByUserId.toString() === requestingUserId) {
      throw ForbiddenError('The payer cannot request resolution — the other person must confirm receipt');
    }
    if (expense.pendingConfirmation) throw BadRequestError('Resolution is already pending confirmation');

    expense.pendingConfirmation = true;
    expense.pendingConfirmationAt = new Date();
    expense.pendingConfirmationByUserId = requestingUserId as unknown as typeof expense.pendingConfirmationByUserId;
    expense.lastDisputedAt = undefined;
    await expense.save();

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap, requestingUserId);
  }

  async confirmResolution(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the claim/resolve flow');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) throw NotFoundError('Expense not found');
    if (!expense.paidByUserId) throw BadRequestError('Expense has no payer');
    if (expense.paidByUserId.toString() !== requestingUserId) {
      throw ForbiddenError('Only the payer can confirm receipt of payment');
    }
    if (!expense.pendingConfirmation) throw BadRequestError('No pending resolution to confirm');
    if (expense.isResolved) throw BadRequestError('This expense is already resolved');

    expense.isResolved = true;
    expense.resolvedAt = new Date();
    expense.resolvedByUserId = requestingUserId as unknown as typeof expense.resolvedByUserId;
    expense.pendingConfirmation = false;
    expense.pendingConfirmationAt = undefined;
    expense.pendingConfirmationByUserId = undefined;
    expense.lastDisputedAt = undefined;
    await expense.save();

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap, requestingUserId);
  }

  async disputeResolution(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    if (household.settings?.financeMode === 'joint') {
      throw BadRequestError('Joint accounts do not use the claim/resolve flow');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) throw NotFoundError('Expense not found');
    if (!expense.paidByUserId) throw BadRequestError('Expense has no payer');
    if (expense.paidByUserId.toString() !== requestingUserId) {
      throw ForbiddenError('Only the payer can dispute a resolution request');
    }
    if (!expense.pendingConfirmation) throw BadRequestError('No pending resolution to dispute');

    expense.pendingConfirmation = false;
    expense.pendingConfirmationAt = undefined;
    expense.pendingConfirmationByUserId = undefined;
    expense.lastDisputedAt = new Date();
    await expense.save();

    const nicknameMap = this.buildNicknameMap(household.members);
    return this.formatExpenseResponse(expense, nicknameMap, requestingUserId);
  }

  async assertExpenseInHousehold(householdId: string, expenseId: string): Promise<void> {
    const exists = await Expense.exists({ _id: expenseId, householdId });
    if (!exists) throw NotFoundError('Expense not found in this household');
  }

  async autoConfirmExpiredPending(): Promise<number> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expenses = await Expense.find({
      pendingConfirmation: true,
      pendingConfirmationAt: { $lt: cutoff },
      isResolved: false,
    })
      .select({ _id: 1, pendingConfirmationByUserId: 1 })
      .lean();

    if (expenses.length === 0) return 0;

    const now = new Date();
    await Expense.bulkWrite(
      expenses.map((e) => ({
        updateOne: {
          filter: { _id: e._id },
          update: {
            $set: {
              isResolved: true,
              resolvedAt: now,
              resolvedByUserId: e.pendingConfirmationByUserId,
              pendingConfirmation: false,
            },
            $unset: {
              pendingConfirmationAt: '',
              pendingConfirmationByUserId: '',
            },
          },
        },
      }))
    );

    return expenses.length;
  }

  private buildNicknameMap(members: Array<{ userId?: { toString(): string } | null; nickname: string }>): Map<string, string> {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.userId) map.set(m.userId.toString(), m.nickname);
    }
    return map;
  }

  formatExpenseResponse(expense: IExpense, nicknameMapOrName?: Map<string, string> | string, _callerUserId?: string): IExpenseResponse {
    const paidByNickname = typeof nicknameMapOrName === 'string'
      ? nicknameMapOrName
      : (nicknameMapOrName && expense.paidByUserId ? nicknameMapOrName.get(expense.paidByUserId.toString()) : undefined);
    const pendingConfirmationByNickname = (nicknameMapOrName instanceof Map && expense.pendingConfirmationByUserId)
      ? nicknameMapOrName.get(expense.pendingConfirmationByUserId.toString())
      : undefined;

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
      ...(expense.resolvedByUserId && { resolvedByUserId: expense.resolvedByUserId.toString() }),
      pendingConfirmation: expense.pendingConfirmation ?? false,
      ...(expense.pendingConfirmationAt && { pendingConfirmationAt: expense.pendingConfirmationAt.toISOString() }),
      ...(expense.pendingConfirmationByUserId && { pendingConfirmationByUserId: expense.pendingConfirmationByUserId.toString() }),
      ...(pendingConfirmationByNickname && { pendingConfirmationByNickname }),
      ...(expense.lastDisputedAt && { lastDisputedAt: expense.lastDisputedAt.toISOString() }),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}

export const expenseService = new ExpenseService();
