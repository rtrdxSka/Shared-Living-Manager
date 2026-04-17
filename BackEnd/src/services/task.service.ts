import { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { Task } from '../models/task.model';
import { ITask, IAddTaskInput, ITaskResponse, IRotationStatus, IAssignTaskInput, IListTasksInput } from '../types/task.types';
import { parsePaginationParams } from '../utils/pagination';
import { IHouseholdMember, ITaskRotationConfig, ISetRotationInput } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';

class TaskService {
  // ── Any member ────────────────────────────────────────────────────────

  async addTask(
    householdId: string,
    userId: string,
    input: IAddTaskInput
  ): Promise<ITaskResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInTasks) {
      throw ForbiddenError('You do not participate in household tasks');
    }

    const task = await Task.create({
      householdId: household._id,
      title: input.title.trim(),
      ...(input.notes?.trim() && { notes: input.notes.trim() }),
      ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
      createdByUserId: userId,
    });

    if (
      household.settings.taskDistributionMethod === 'rotation' &&
      household.settings.taskRotationConfig
    ) {
      const rotStatus = this.computeRotationStatus(
        household.settings.taskRotationConfig,
        household.members
      );
      if (rotStatus) {
        task.assignedToMemberId = new Types.ObjectId(rotStatus.currentMemberId);
        await task.save();
      }
    }

    if (
      household.settings.taskDistributionMethod === 'fixed' &&
      input.assignedToMemberId
    ) {
      const assignee = household.members.find(
        (m) => m._id.toString() === input.assignedToMemberId
      );
      if (!assignee) throw BadRequestError('assignedToMemberId does not match a household member');
      if (!assignee.participatesInTasks) {
        throw BadRequestError('That member does not participate in tasks');
      }
      task.assignedToMemberId = new Types.ObjectId(input.assignedToMemberId);
      await task.save();
    }

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }
    const assignedToMemberId = task.assignedToMemberId?.toString();
    const assignedToNickname = assignedToMemberId
      ? memberMap.get(assignedToMemberId)
      : undefined;

    return this.formatTaskResponse(task, assignedToMemberId, assignedToNickname);
  }

  async listTasks(
    householdId: string,
    userId: string,
    input: IListTasksInput = {}
  ): Promise<{ tasks: ITaskResponse[]; total: number; page: number; totalPages: number; rotation?: IRotationStatus }> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const { page, limit, skip } = parsePaginationParams(input);
    const filter = { householdId: household._id };
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);

    // Build member ID → nickname map for completedByMemberId lookups
    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    let rotation: IRotationStatus | undefined;

    const method = household.settings.taskDistributionMethod;
    const isRotation =
      method === 'rotation' && household.settings.taskRotationConfig != null;

    if (isRotation) {
      const rotStatus = this.computeRotationStatus(
        household.settings.taskRotationConfig!,
        household.members
      );
      if (rotStatus) {
        rotation = rotStatus;
      }
    }

    const taskResponses = tasks.map((task) => {
      let assignedToMemberId: string | undefined;
      let assignedToNickname: string | undefined;

      if (task.assignedToMemberId) {
        assignedToMemberId = task.assignedToMemberId.toString();
        assignedToNickname = memberMap.get(assignedToMemberId);
      }

      return this.formatTaskResponse(
        task,
        assignedToMemberId,
        assignedToNickname,
        task.completedByMemberId
          ? (memberMap.get(task.completedByMemberId.toString()) ?? 'Unknown')
          : undefined
      );
    });

    return { tasks: taskResponses, total, page, totalPages: Math.ceil(total / limit) || 1, ...(rotation && { rotation }) };
  }

  async toggleComplete(
    householdId: string,
    userId: string,
    taskId: string
  ): Promise<ITaskResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInTasks) {
      throw ForbiddenError('You do not participate in household tasks');
    }

    const task = await Task.findOne({ _id: taskId, householdId: household._id });
    if (!task) throw NotFoundError('Task not found');

    if (task.isCompleted) {
      const pastOneDay =
        task.completedAt != null && Date.now() - task.completedAt.getTime() >= 86_400_000;
      if (pastOneDay) {
        throw ForbiddenError('This task can no longer be marked incomplete');
      }
      const isAdmin = requesterMember.role === 'owner' || requesterMember.role === 'admin';
      const isCompleter = task.completedByMemberId?.toString() === requesterMember._id.toString();
      if (!isAdmin && !isCompleter) {
        throw ForbiddenError(
          'Only the admin or the person who completed this task can undo it within 24 hours'
        );
      }
    }

    task.isCompleted = !task.isCompleted;
    if (task.isCompleted) {
      task.completedAt = new Date();
      task.completedByMemberId = requesterMember._id as unknown as Types.ObjectId;
    } else {
      task.completedAt = undefined;
      task.completedByMemberId = undefined;
    }
    await task.save();

    const completedByNickname = task.isCompleted ? requesterMember.nickname : undefined;

    let assignedToMemberId: string | undefined;
    let assignedToNickname: string | undefined;
    if (task.assignedToMemberId) {
      assignedToMemberId = task.assignedToMemberId.toString();
      const assignedMember = household.members.find(
        (m) => m._id.toString() === assignedToMemberId
      );
      assignedToNickname = assignedMember?.nickname;
    }

    return this.formatTaskResponse(task, assignedToMemberId, assignedToNickname, completedByNickname);
  }

  // ── Creator or admin can delete ───────────────────────────────────────

  async deleteTask(
    householdId: string,
    userId: string,
    taskId: string
  ): Promise<void> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInTasks) {
      throw ForbiddenError('You do not participate in household tasks');
    }

    const task = await Task.findOne({ _id: taskId, householdId: household._id });
    if (!task) throw NotFoundError('Task not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isCreator = task.createdByUserId.toString() === userId;

    if (!isCreator && !isAdminOrOwner) {
      throw ForbiddenError('You can only delete tasks you created');
    }

    await task.deleteOne();
  }

  // ── Assign / unassign task ────────────────────────────────────────────

  async assignTask(
    householdId: string,
    userId: string,
    taskId: string,
    input: IAssignTaskInput
  ): Promise<ITaskResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInTasks) {
      throw ForbiddenError('You do not participate in household tasks');
    }

    const task = await Task.findOne({ _id: taskId, householdId: household._id });
    if (!task) throw NotFoundError('Task not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';

    if (household.settings.taskDistributionMethod === 'fixed') {
      const isCreator = task.createdByUserId.toString() === userId;
      if (!isAdminOrOwner && !isCreator) {
        throw ForbiddenError('Only the task creator or an admin can reassign tasks');
      }
    }

    if (input.assignedToMemberId !== null) {
      // Regular members can only assign tasks to themselves
      if (!isAdminOrOwner && input.assignedToMemberId !== requesterMember._id.toString()) {
        throw ForbiddenError('You can only assign tasks to yourself');
      }

      const assignee = household.members.find(
        (m) => m._id.toString() === input.assignedToMemberId
      );
      if (!assignee) throw BadRequestError('assignedToMemberId does not match a household member');
      if (!assignee.participatesInTasks) {
        throw BadRequestError('That member does not participate in tasks');
      }
      task.assignedToMemberId = new Types.ObjectId(input.assignedToMemberId);
    } else {
      // Regular members can only unassign tasks currently assigned to themselves
      if (!isAdminOrOwner && task.assignedToMemberId?.toString() !== requesterMember._id.toString()) {
        throw ForbiddenError('You can only unassign tasks assigned to yourself');
      }
      task.assignedToMemberId = undefined;
    }

    await task.save();

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const assignedToNickname = task.assignedToMemberId
      ? memberMap.get(task.assignedToMemberId.toString())
      : undefined;

    const completedByNickname = task.completedByMemberId
      ? (memberMap.get(task.completedByMemberId.toString()) ?? 'Unknown')
      : undefined;

    return this.formatTaskResponse(
      task,
      task.assignedToMemberId?.toString(),
      assignedToNickname,
      completedByNickname
    );
  }

  // ── Admin/owner only ──────────────────────────────────────────────────

  async setRotation(
    householdId: string,
    userId: string,
    input: ISetRotationInput
  ): Promise<IRotationStatus> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    if (requesterMember.role !== 'owner' && requesterMember.role !== 'admin') {
      throw ForbiddenError('Only admins can configure task rotation');
    }

    const taskMembers = household.members.filter((m) => m.participatesInTasks);
    if (taskMembers.length === 0) {
      throw BadRequestError('No members participate in tasks');
    }

    const startIdx = taskMembers.findIndex((m) => m._id.toString() === input.startMemberId);
    if (startIdx === -1) {
      throw BadRequestError('startMemberId does not match a task-participating member');
    }

    const orderedMembers = [
      ...taskMembers.slice(startIdx),
      ...taskMembers.slice(0, startIdx),
    ];
    const orderedMemberIds = orderedMembers.map((m) => m._id) as Types.ObjectId[];

    household.settings.taskRotationConfig = {
      orderedMemberIds,
      startedAt: new Date(),
      periodDays: 7,
    };

    await household.save();

    const rotationStatus = this.computeRotationStatus(
      household.settings.taskRotationConfig,
      household.members
    );

    if (!rotationStatus) throw BadRequestError('Failed to compute rotation status');

    return rotationStatus;
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private computeRotationStatus(
    config: ITaskRotationConfig,
    members: IHouseholdMember[]
  ): IRotationStatus | null {
    const { orderedMemberIds, startedAt, periodDays } = config;
    if (!orderedMemberIds.length) return null;

    const elapsed = Date.now() - new Date(startedAt).getTime();
    const currentIndex = Math.floor(elapsed / (periodDays * 86_400_000));
    const nextIndex = currentIndex + 1;

    const currentMemberId = orderedMemberIds[currentIndex % orderedMemberIds.length];
    const nextMemberId = orderedMemberIds[nextIndex % orderedMemberIds.length];

    const findNickname = (id: Types.ObjectId): string => {
      const m = members.find((mem) => mem._id.toString() === id.toString());
      return m?.nickname ?? 'Unknown';
    };

    const startTime = new Date(startedAt).getTime();
    const currentPeriodStart = new Date(startTime + currentIndex * periodDays * 86_400_000);
    const nextPeriodStart = new Date(currentPeriodStart.getTime() + periodDays * 86_400_000);

    return {
      currentMemberId: currentMemberId.toString(),
      currentNickname: findNickname(currentMemberId),
      nextMemberId: nextMemberId.toString(),
      nextNickname: findNickname(nextMemberId),
      periodDays,
      currentPeriodStartDate: currentPeriodStart.toISOString(),
      nextPeriodStartDate: nextPeriodStart.toISOString(),
    };
  }

  private formatTaskResponse(
    task: ITask,
    assignedToMemberId?: string,
    assignedToNickname?: string,
    completedByNickname?: string
  ): ITaskResponse {
    return {
      _id: task._id.toString(),
      householdId: task.householdId.toString(),
      title: task.title,
      ...(task.notes && { notes: task.notes }),
      ...(task.dueDate && { dueDate: task.dueDate.toISOString() }),
      createdByUserId: task.createdByUserId.toString(),
      isCompleted: task.isCompleted,
      ...(task.completedAt && { completedAt: task.completedAt.toISOString() }),
      ...(task.completedByMemberId && { completedByMemberId: task.completedByMemberId.toString() }),
      ...(completedByNickname && { completedByNickname }),
      ...(assignedToMemberId && { assignedToMemberId }),
      ...(assignedToNickname && { assignedToNickname }),
      ...(task.recurringTaskId && { recurringTaskId: task.recurringTaskId.toString() }),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}

export const taskService = new TaskService();
