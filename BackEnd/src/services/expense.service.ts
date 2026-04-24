import { Household } from '../models/household.model';
import { Expense } from '../models/expense.model';
import { IAddExpenseInput, IListExpensesInput, IExpenseResponse, IExpense, IUpdateExpenseInput } from '../types/expense.types';
import { ExpenseType } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { IPaginatedResult } from '../types/pagination.types';
import { parsePaginationParams, buildPaginatedResult } from '../utils/pagination';
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
      // Only the requester can claim payment for themselves, unless they are admin/owner
      const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
      if (input.paidByUserId !== requestingUserId && !isAdminOrOwner) {
        throw ForbiddenError('You can only set yourself as the payer');
      }

      const payerMember = household.members.find(
        (m) => m.userId?.toString() === input.paidByUserId && m.participatesInFinances
      );
      if (!payerMember) {
        throw BadRequestError('paidByUserId does not match a financial household member');
      }
      payerNickname = payerMember.nickname;
    }

    // 4. Create expense
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
    });

    // 5. Return formatted response
    return this.formatExpenseResponse(expense, payerNickname);
  }

  async listExpenses(
    householdId: string,
    requestingUserId: string,
    input: IListExpensesInput
  ): Promise<IPaginatedResult<IExpenseResponse>> {
    // 1. Find household + verify requester is a member
    const { household } = await getHouseholdForMember(householdId, requestingUserId);

    // 3. Build query filter
    const query: {
      householdId: typeof household._id;
      date?: { $gte: Date; $lt: Date };
      category?: ExpenseType;
    } = {
      householdId: household._id,
    };

    if (input.month !== 'all') {
      const { start, end } = this.buildMonthRange(input.month);
      query.date = { $gte: start, $lt: end };
    }

    if (input.category) {
      query.category = input.category;
    }

    // 5. Paginate
    const { page, limit, skip } = parsePaginationParams(input);
    const [expenses, total] = await Promise.all([
      Expense.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(query),
    ]);

    // 6. Build nickname map
    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    // 7. Map to response
    const items = expenses.map((expense) => this.formatExpenseResponse(expense, nicknameMap));

    return buildPaginatedResult(items, total, page, limit);
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
      throw ForbiddenError('Cannot delete a resolved expense');
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
      throw ForbiddenError('Cannot modify a resolved expense');
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
        // Only the requester can claim payment for themselves, unless they are admin/owner
        const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
        if (input.paidByUserId !== requestingUserId && !isAdminOrOwner) {
          throw ForbiddenError('You can only set yourself as the payer');
        }

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

    // Verify requester is a financial member
    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === requestingUserId && m.participatesInFinances
    );
    if (!requesterMember) {
      throw ForbiddenError('You must be a financial member to claim an expense');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) {
      throw NotFoundError('Expense not found');
    }

    if (expense.paidByUserId) {
      throw BadRequestError('This expense has already been claimed');
    }

    expense.paidByUserId = requesterMember.userId as unknown as typeof expense.paidByUserId;
    await expense.save();

    return this.formatExpenseResponse(expense, requesterMember.nickname);
  }

  async requestResolution(
    householdId: string,
    requestingUserId: string,
    expenseId: string
  ): Promise<IExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

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

  async autoConfirmExpiredPending(): Promise<number> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expenses = await Expense.find({
      pendingConfirmation: true,
      pendingConfirmationAt: { $lt: cutoff },
      isResolved: false,
    });

    await Promise.all(
      expenses.map((expense) => {
        expense.isResolved = true;
        expense.resolvedAt = new Date();
        expense.resolvedByUserId = expense.pendingConfirmationByUserId as unknown as typeof expense.resolvedByUserId;
        expense.pendingConfirmation = false;
        expense.pendingConfirmationAt = undefined;
        expense.pendingConfirmationByUserId = undefined;
        return expense.save();
      })
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
