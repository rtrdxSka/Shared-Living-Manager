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
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

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
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const templates = await RecurringTask.find({ householdId: household._id, isActive: true })
      .sort({ createdAt: -1 });

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
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const template = await RecurringTask.findOne({ _id: recurringTaskId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring task not found');

    if (template.createdByUserId.toString() !== userId) {
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
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const template = await RecurringTask.findOne({ _id: recurringTaskId, householdId: household._id });
    if (!template) throw NotFoundError('Recurring task not found');

    if (template.createdByUserId.toString() !== userId) {
      throw ForbiddenError('You can only deactivate recurring tasks you created');
    }

    template.isActive = false;
    await template.save();
  }

  async generateInstances(interval: RecurrenceInterval): Promise<void> {
    const templates = await RecurringTask.find({ interval, isActive: true });

    for (const template of templates) {
      try {
        // Compute period start (UTC)
        const now = new Date();
        let periodStart: Date;
        if (interval === 'monthly') {
          periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        } else if (interval === 'weekly') {
          // weekly — start of current week (Monday)
          const day = now.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
        } else {
          // daily — current UTC date at midnight
          periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        }

        // Idempotency check
        const existing = await Task.findOne({
          recurringTaskId: template._id,
          createdAt: { $gte: periodStart },
        });
        if (existing) continue;

        // Load household to determine distribution method and members
        const household = await Household.findById(template.householdId);
        if (!household) continue;

        // Verify creator is still a participating member
        const creator = household.members.find(
          (m) => m.userId?.toString() === template.createdByUserId.toString()
        );
        if (!creator || !creator.participatesInTasks) {
          template.isActive = false;
          await template.save();
          continue;
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
          recurringTaskId: template._id,
          ...(assignedToMemberId && { assignedToMemberId }),
        });
      } catch (err) {
        console.error(`Failed to generate instance for recurring task ${template._id.toString()}:`, err);
      }
    }
  }
}

export const recurringTaskService = new RecurringTaskService();
