import { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { Task } from '../models/task.model';
import { RecurringTask } from '../models/recurring-task.model';
import {
  ICreateRecurringTaskInput,
  IUpdateRecurringTaskInput,
  IRecurringTaskResponse,
  IRecurringTask,
  RecurrenceInterval,
} from '../types/recurring-task.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { logger } from '../utils/logger';
import { getHouseholdForMember } from '../utils/household.helpers';
import { SCHEDULER_BATCH_SIZE } from '../scheduler/constants';

class RecurringTaskService {
  private formatResponse(
    template: IRecurringTask,
    assignedToNickname?: string
  ): IRecurringTaskResponse {
    return {
      _id: template._id.toString(),
      householdId: template.householdId.toString(),
      createdByUserId: template.createdByUserId.toString(),
      title: template.title,
      ...(template.notes && { notes: template.notes }),
      interval: template.interval,
      ...(template.assignedToMemberId && { assignedToMemberId: template.assignedToMemberId.toString() }),
      ...(assignedToNickname && { assignedToNickname }),
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  async create(
    householdId: string,
    userId: string,
    input: ICreateRecurringTaskInput
  ): Promise<IRecurringTaskResponse> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);
    if (!requesterMember.participatesInTasks) {
      throw ForbiddenError('You do not participate in household tasks');
    }

    let assignedToNickname: string | undefined;
    if (input.assignedToMemberId) {
      const member = household.members.find((m) => m._id.toString() === input.assignedToMemberId);
      if (!member) throw BadRequestError('assignedToMemberId does not match a household member');
      if (!member.participatesInTasks) {
        throw BadRequestError('That member does not participate in tasks');
      }
      assignedToNickname = member.nickname;
    }

    const template = await RecurringTask.create({
      householdId: household._id,
      createdByUserId: userId,
      title: input.title.trim(),
      ...(input.notes?.trim() && { notes: input.notes.trim() }),
      interval: input.interval,
      ...(input.assignedToMemberId && { assignedToMemberId: new Types.ObjectId(input.assignedToMemberId) }),
    });

    return this.formatResponse(template, assignedToNickname);
  }

  async list(
    householdId: string,
    userId: string
  ): Promise<IRecurringTaskResponse[]> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const templates = await RecurringTask.find({ householdId: household._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    return templates.map((t) =>
      this.formatResponse(
        t,
        t.assignedToMemberId ? memberMap.get(t.assignedToMemberId.toString()) : undefined
      )
    );
  }

  async update(
    householdId: string,
    userId: string,
    recurringTaskId: string,
    input: IUpdateRecurringTaskInput
  ): Promise<IRecurringTaskResponse> {
    const { household, member } = await getHouseholdForMember(householdId, userId);

    const template = await RecurringTask.findOne({ _id: recurringTaskId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring task not found');

    const isAdmin = member.role === 'owner' || member.role === 'admin';
    if (template.createdByUserId.toString() !== userId && !isAdmin) {
      throw ForbiddenError('You can only edit recurring tasks you created');
    }

    if (input.assignedToMemberId !== undefined && input.assignedToMemberId !== null) {
      const member = household.members.find((m) => m._id.toString() === input.assignedToMemberId);
      if (!member) throw BadRequestError('assignedToMemberId does not match a household member');
      if (!member.participatesInTasks) {
        throw BadRequestError('That member does not participate in tasks');
      }
    }

    if (input.title !== undefined) template.title = input.title.trim();
    if (input.notes !== undefined) template.notes = input.notes ?? undefined;
    if (input.interval !== undefined) template.interval = input.interval;
    if (input.assignedToMemberId !== undefined) {
      template.assignedToMemberId = input.assignedToMemberId
        ? (new Types.ObjectId(input.assignedToMemberId) as unknown as Types.ObjectId)
        : undefined;
    }

    await template.save();

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const assignedToNickname = template.assignedToMemberId
      ? memberMap.get(template.assignedToMemberId.toString())
      : undefined;

    return this.formatResponse(template, assignedToNickname);
  }

  async deactivate(
    householdId: string,
    userId: string,
    recurringTaskId: string
  ): Promise<void> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);

    const template = await RecurringTask.findOne({ _id: recurringTaskId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring task not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    if (template.createdByUserId.toString() !== userId && !isAdminOrOwner) {
      throw ForbiddenError('You can only deactivate recurring tasks you created');
    }

    template.isActive = false;
    await template.save();
  }

  async generateInstances(interval: RecurrenceInterval): Promise<void> {
    const templates = await RecurringTask.find({ interval, isActive: true })
      .sort({ updatedAt: 1 })
      .limit(SCHEDULER_BATCH_SIZE);
    if (templates.length === 0) return;

    // Compute period start once — same for all templates of the same interval
    const now = new Date();
    let periodStart: Date;
    if (interval === 'monthly') {
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else if (interval === 'weekly') {
      const day = now.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
    } else {
      // daily — current UTC date at midnight
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    // Batch-fetch all needed households in one query
    const uniqueHouseholdIds = [...new Set(templates.map((t) => t.householdId.toString()))];
    const households = await Household.find({ _id: { $in: uniqueHouseholdIds } });
    const householdMap = new Map(households.map((h) => [h._id.toString(), h]));

    // Batch idempotency check — find all already-generated instances for this period
    const templateIds = templates.map((t) => t._id);
    const existingTasks = await Task.find({
      recurringTaskId: { $in: templateIds },
      createdAt: { $gte: periodStart },
    }).select('recurringTaskId');
    const existingSet = new Set(
      existingTasks.map((t) => t.recurringTaskId!.toString())
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

        // Verify creator is still a participating member
        const creator = household.members.find(
          (m) => m.userId?.toString() === template.createdByUserId.toString()
        );
        if (!creator || !creator.participatesInTasks) {
          template.isActive = false;
          await template.save();
          return;
        }

        const method = household.settings.taskDistributionMethod;
        let assignedToMemberId: Types.ObjectId | undefined;

        if (method === 'rotation' && household.settings.taskRotationConfig) {
          const config = household.settings.taskRotationConfig;
          const { orderedMemberIds, startedAt, periodDays } = config;
          if (orderedMemberIds.length > 0) {
            const elapsed = Date.now() - new Date(startedAt).getTime();
            const index = Math.floor(elapsed / (periodDays * 86_400_000));
            assignedToMemberId = orderedMemberIds[index % orderedMemberIds.length] as Types.ObjectId;
          }
        } else if (method === 'fixed' && template.assignedToMemberId) {
          assignedToMemberId = template.assignedToMemberId;
        }

        await Task.create({
          householdId: template.householdId,
          createdByUserId: template.createdByUserId,
          title: template.title,
          ...(template.notes && { notes: template.notes }),
          dueDate: periodStart,
          recurringTaskId: template._id,
          ...(assignedToMemberId && { assignedToMemberId }),
        });
      } catch (err) {
        logger.error(
          { err, templateId: template._id.toString() },
          'Failed to generate instance for recurring task'
        );
      }
    };

    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(processOne));
    }

    logger.info(
      {
        interval,
        processed: templates.length,
        batchSize: SCHEDULER_BATCH_SIZE,
        hasMore: templates.length === SCHEDULER_BATCH_SIZE,
      },
      'recurring-task generateInstances complete'
    );
  }
}

export const recurringTaskService = new RecurringTaskService();
