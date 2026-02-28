import { Household } from '../models/household.model';
import { Expense } from '../models/expense.model';
import { IAddExpenseInput, IListExpensesInput, IExpenseResponse, IExpense, IUpdateExpenseInput } from '../types/expense.types';
import { ExpenseType } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';

class ExpenseService {
  async addExpense(
    householdId: string,
    requestingUserId: string,
    input: IAddExpenseInput
  ): Promise<IExpenseResponse> {
    // 1. Find household
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    // 2. Verify requester is a member
    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!requesterMember) {
      throw ForbiddenError('You are not a member of this household');
    }

    // 3. Verify payer is a member with a userId
    const payerMember = household.members.find(
      (m) => m.userId?.toString() === input.paidByUserId
    );
    if (!payerMember) {
      throw BadRequestError('paidByUserId does not match any household member');
    }

    // 4. Create expense
    const expense = await Expense.create({
      householdId: household._id,
      paidByUserId: input.paidByUserId,
      createdByUserId: requestingUserId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      date: new Date(input.date),
      ...(input.notes && { notes: input.notes }),
    });

    // 5. Return formatted response
    return this.formatExpenseResponse(expense, payerMember.nickname);
  }

  async listExpenses(
    householdId: string,
    requestingUserId: string,
    input: IListExpensesInput
  ): Promise<IExpenseResponse[]> {
    // 1. Find household
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    // 2. Verify requester is a member
    const isMember = household.members.some(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!isMember) {
      throw ForbiddenError('You are not a member of this household');
    }

    // 3. Build month range
    const { start, end } = this.buildMonthRange(input.month);

    // 4. Query expenses
    const query: {
      householdId: typeof household._id;
      date: { $gte: Date; $lt: Date };
      category?: ExpenseType;
    } = {
      householdId: household._id,
      date: { $gte: start, $lt: end },
    };

    if (input.category) {
      query.category = input.category;
    }

    const expenses = await Expense.find(query).sort({ date: -1 });

    // 5. Build nickname map
    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    // 6. Map to response
    return expenses.map((expense) =>
      this.formatExpenseResponse(
        expense,
        nicknameMap.get(expense.paidByUserId.toString()) ?? 'Unknown'
      )
    );
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
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    const isMember = household.members.some(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!isMember) {
      throw ForbiddenError('You are not a member of this household');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) {
      throw NotFoundError('Expense not found');
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
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    const isMember = household.members.some(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!isMember) {
      throw ForbiddenError('You are not a member of this household');
    }

    const expense = await Expense.findOne({ _id: expenseId, householdId: household._id });
    if (!expense) {
      throw NotFoundError('Expense not found');
    }

    if (expense.createdByUserId.toString() !== requestingUserId) {
      throw ForbiddenError('You can only edit expenses you created');
    }

    if (input.paidByUserId !== undefined) {
      const payerMember = household.members.find(
        (m) => m.userId?.toString() === input.paidByUserId
      );
      if (!payerMember) {
        throw BadRequestError('paidByUserId does not match any household member');
      }
    }

    if (input.description !== undefined) expense.description = input.description;
    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.category !== undefined) expense.category = input.category;
    if (input.date !== undefined) expense.date = new Date(input.date);
    if (input.notes !== undefined) expense.notes = input.notes;
    if (input.paidByUserId !== undefined) expense.paidByUserId = input.paidByUserId as unknown as typeof expense.paidByUserId;

    await expense.save();

    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }
    const paidByNickname = nicknameMap.get(expense.paidByUserId.toString()) ?? 'Unknown';

    return this.formatExpenseResponse(expense, paidByNickname);
  }

  private formatExpenseResponse(expense: IExpense, paidByNickname: string): IExpenseResponse {
    return {
      _id: expense._id.toString(),
      householdId: expense.householdId.toString(),
      paidByUserId: expense.paidByUserId.toString(),
      paidByNickname,
      createdByUserId: expense.createdByUserId?.toString() ?? '',
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date.toISOString(),
      ...(expense.notes && { notes: expense.notes }),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}

export const expenseService = new ExpenseService();
