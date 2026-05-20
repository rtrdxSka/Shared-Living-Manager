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
import { logger } from '../utils/logger';
import { getHouseholdForMember } from '../utils/household.helpers';

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
      isFullRepayment: template.isFullRepayment,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  async create(
    householdId: string,
    userId: string,
    input: ICreateRecurringExpenseInput
  ): Promise<IRecurringExpenseResponse> {
    const { household, member } = await getHouseholdForMember(householdId, userId);
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
      isFullRepayment: input.isFullRepayment ?? false,
    });

    return this.formatResponse(template, fixedPayerNickname);
  }

  async list(
    householdId: string,
    userId: string
  ): Promise<IRecurringExpenseResponse[]> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const nicknameMap = new Map<string, string>();
    for (const member of household.members) {
      if (member.userId) {
        nicknameMap.set(member.userId.toString(), member.nickname);
      }
    }

    const templates = await RecurringExpense.find({ householdId: household._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

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
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);

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
    if (input.isFullRepayment !== undefined) template.isFullRepayment = input.isFullRepayment;

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
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);

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
    if (templates.length === 0) return;

    // Compute period start once — same for all templates of the same interval
    const now = new Date();
    let periodStart: Date;
    if (interval === 'monthly') {
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else {
      // weekly — start of current week (Monday)
      const day = now.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
    }

    // Batch-fetch all needed households in one query
    const uniqueHouseholdIds = [...new Set(templates.map((t) => t.householdId.toString()))];
    const households = await Household.find({ _id: { $in: uniqueHouseholdIds } });
    const householdMap = new Map(households.map((h) => [h._id.toString(), h]));

    // Batch idempotency check — find all already-generated instances for this period
    const templateIds = templates.map((t) => t._id);
    const existingExpenses = await Expense.find({
      recurringExpenseId: { $in: templateIds },
      date: { $gte: periodStart },
    }).select('recurringExpenseId');
    const existingSet = new Set(
      existingExpenses.map((e) => e.recurringExpenseId!.toString())
    );

    // Process templates in parallel batches to avoid overwhelming the DB
    // connection pool (maxPoolSize = 10 in config/database.ts).
    const BATCH_SIZE = 10;
    const processOne = async (template: typeof templates[number]): Promise<void> => {
      try {
        // Idempotency check via pre-fetched set
        if (existingSet.has(template._id.toString())) return;

        // Household lookup via pre-fetched map
        const household = householdMap.get(template.householdId.toString());
        if (!household) return;

        const creator = household.members.find(
          (m) => m.userId?.toString() === template.createdByUserId.toString()
        );
        if (!creator || !creator.participatesInFinances) {
          template.isActive = false;
          await template.save();
          return;
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
          isFullRepayment: template.isFullRepayment,
        });
      } catch (err) {
        logger.error(
          { err, templateId: template._id.toString() },
          'Failed to generate instance for recurring expense'
        );
      }
    };

    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(processOne));
    }
  }
}

export const recurringExpenseService = new RecurringExpenseService();
