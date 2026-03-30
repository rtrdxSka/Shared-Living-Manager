import { Household } from '../models/household.model';
import { Expense } from '../models/expense.model';
import { RecurringExpense } from '../models/recurring-expense.model';
import {
  ICreateRecurringExpenseInput,
  IUpdateRecurringExpenseInput,
  IRecurringExpenseResponse,
  IRecurringExpense,
  RecurrenceInterval,
} from '../types/recurring-expense.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';

class RecurringExpenseService {
  private formatResponse(
    template: IRecurringExpense,
    fixedPayerNickname?: string
  ): IRecurringExpenseResponse {
    return {
      _id: template._id.toString(),
      householdId: template.householdId.toString(),
      createdByUserId: template.createdByUserId.toString(),
      description: template.description,
      amount: template.amount,
      category: template.category,
      ...(template.notes && { notes: template.notes }),
      interval: template.interval,
      payerMode: template.payerMode,
      ...(template.fixedPayerUserId && { fixedPayerUserId: template.fixedPayerUserId.toString() }),
      ...(fixedPayerNickname && { fixedPayerNickname }),
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  async create(
    householdId: string,
    userId: string,
    input: ICreateRecurringExpenseInput
  ): Promise<IRecurringExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const member = household.members.find((m) => m.userId?.toString() === userId);
    if (!member) throw ForbiddenError('You are not a member of this household');
    if (!member.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    let fixedPayerNickname: string | undefined;
    if (input.payerMode === 'fixed') {
      if (!input.fixedPayerUserId) {
        throw BadRequestError('fixedPayerUserId is required when payerMode is fixed');
      }

      // Regular members can only set themselves as the fixed payer
      const isAdminOrOwner = member.role === 'owner' || member.role === 'admin';
      if (input.fixedPayerUserId !== userId && !isAdminOrOwner) {
        throw ForbiddenError('You can only set yourself as the fixed payer');
      }

      const payerMember = household.members.find(
        (m) => m.userId?.toString() === input.fixedPayerUserId && m.participatesInFinances
      );
      if (!payerMember) {
        throw BadRequestError('fixedPayerUserId does not match any financial household member');
      }
      fixedPayerNickname = payerMember.nickname;
    }

    const template = await RecurringExpense.create({
      householdId: household._id,
      createdByUserId: userId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      ...(input.notes && { notes: input.notes }),
      interval: input.interval,
      payerMode: input.payerMode,
      ...(input.fixedPayerUserId && { fixedPayerUserId: input.fixedPayerUserId }),
    });

    return this.formatResponse(template, fixedPayerNickname);
  }

  async list(
    householdId: string,
    userId: string
  ): Promise<IRecurringExpenseResponse[]> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    const templates = await RecurringExpense.find({ householdId: household._id, isActive: true })
      .sort({ createdAt: -1 });

    return templates.map((t) =>
      this.formatResponse(
        t,
        t.fixedPayerUserId ? nicknameMap.get(t.fixedPayerUserId.toString()) : undefined
      )
    );
  }

  async update(
    householdId: string,
    userId: string,
    recurringId: string,
    input: IUpdateRecurringExpenseInput
  ): Promise<IRecurringExpenseResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const template = await RecurringExpense.findOne({ _id: recurringId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring expense not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    if (template.createdByUserId.toString() !== userId && !isAdminOrOwner) {
      throw ForbiddenError('You can only edit recurring expenses you created');
    }

    // Financial fields (amount, payerMode, fixedPayerUserId, interval) require admin/owner
    const hasFinancialChange =
      input.amount !== undefined ||
      input.payerMode !== undefined ||
      input.fixedPayerUserId !== undefined ||
      input.interval !== undefined;
    if (hasFinancialChange && !isAdminOrOwner) {
      throw ForbiddenError('Only admins can modify financial fields (amount, payer, interval)');
    }

    // Determine effective payerMode after potential update
    const effectivePayerMode = input.payerMode ?? template.payerMode;
    if (effectivePayerMode === 'fixed') {
      const effectiveFixedPayerId = input.fixedPayerUserId ?? template.fixedPayerUserId?.toString();
      if (!effectiveFixedPayerId) {
        throw BadRequestError('fixedPayerUserId is required when payerMode is fixed');
      }
      const payerMember = household.members.find(
        (m) => m.userId?.toString() === effectiveFixedPayerId && m.participatesInFinances
      );
      if (!payerMember) {
        throw BadRequestError('fixedPayerUserId does not match any financial household member');
      }
    }

    if (input.description !== undefined) template.description = input.description;
    if (input.amount !== undefined) template.amount = input.amount;
    if (input.category !== undefined) template.category = input.category;
    if (input.notes !== undefined) template.notes = input.notes;
    if (input.interval !== undefined) template.interval = input.interval;
    if (input.payerMode !== undefined) template.payerMode = input.payerMode;
    if (input.fixedPayerUserId !== undefined) {
      template.fixedPayerUserId = input.fixedPayerUserId as unknown as typeof template.fixedPayerUserId;
    }

    await template.save();

    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    const fixedPayerNickname = template.fixedPayerUserId
      ? nicknameMap.get(template.fixedPayerUserId.toString())
      : undefined;

    return this.formatResponse(template, fixedPayerNickname);
  }

  async deactivate(
    householdId: string,
    userId: string,
    recurringId: string
  ): Promise<void> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const template = await RecurringExpense.findOne({ _id: recurringId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring expense not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    if (template.createdByUserId.toString() !== userId && !isAdminOrOwner) {
      throw ForbiddenError('You can only deactivate recurring expenses you created');
    }

    template.isActive = false;
    await template.save();
  }

  async generateInstances(interval: RecurrenceInterval): Promise<void> {
    const templates = await RecurringExpense.find({ interval, isActive: true });

    for (const template of templates) {
      try {
        // Compute period start
        const now = new Date();
        let periodStart: Date;
        if (interval === 'monthly') {
          periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        } else {
          // weekly — start of current week (Monday)
          const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
          const diff = day === 0 ? -6 : 1 - day; // shift to Monday
          periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
        }

        // Idempotency check — skip if an instance already exists for this period
        const existing = await Expense.findOne({
          recurringExpenseId: template._id,
          date: { $gte: periodStart },
        });
        if (existing) continue;

        // Verify creator is still a participating member
        const household = await Household.findById(template.householdId);
        if (!household) continue;

        const creator = household.members.find(
          (m) => m.userId?.toString() === template.createdByUserId.toString()
        );
        if (!creator || !creator.participatesInFinances) {
          template.isActive = false;
          await template.save();
          continue;
        }

        // Create expense instance
        await Expense.create({
          householdId: template.householdId,
          createdByUserId: template.createdByUserId,
          description: template.description,
          amount: template.amount,
          category: template.category,
          date: periodStart,
          ...(template.notes && { notes: template.notes }),
          recurringExpenseId: template._id,
          ...(template.payerMode === 'fixed' && template.fixedPayerUserId
            ? { paidByUserId: template.fixedPayerUserId }
            : {}),
        });
      } catch (err) {
        console.error(`Failed to generate instance for recurring expense ${template._id.toString()}:`, err);
      }
    }
  }
}

export const recurringExpenseService = new RecurringExpenseService();
