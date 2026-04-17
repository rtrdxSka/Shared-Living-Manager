import { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { Goal } from '../models/goal.model';
import {
  IGoal,
  IAddGoalInput,
  IUpdateGoalInput,
  IAddContributionInput,
  IGoalResponse,
  IGoalContributionResponse,
  IListGoalsInput,
} from '../types/goal.types';
import { IHouseholdMember } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { IPaginatedResult } from '../types/pagination.types';
import { parsePaginationParams, buildPaginatedResult } from '../utils/pagination';

class GoalService {
  // ── Any member ────────────────────────────────────────────────────────

  async addGoal(
    householdId: string,
    userId: string,
    input: IAddGoalInput
  ): Promise<IGoalResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.create({
      householdId: household._id,
      name: input.name.trim(),
      ...(input.description?.trim() && { description: input.description.trim() }),
      targetAmount: input.targetAmount,
      ...(input.deadline && { deadline: new Date(input.deadline) }),
      ...(input.category && { category: input.category }),
      createdByUserId: userId,
    });

    return this.formatGoalResponse(goal, household.members);
  }

  async listGoals(
    householdId: string,
    userId: string,
    input: IListGoalsInput = {}
  ): Promise<IPaginatedResult<IGoalResponse>> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const filter: Record<string, unknown> = { householdId: household._id };
    if (input.status) filter.status = input.status;

    const { page, limit, skip } = parsePaginationParams(input);
    const [goals, total] = await Promise.all([
      Goal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Goal.countDocuments(filter),
    ]);

    const items = goals.map((goal) => this.formatGoalResponse(goal, household.members));
    return buildPaginatedResult(items, total, page, limit);
  }

  async getGoal(
    householdId: string,
    userId: string,
    goalId: string
  ): Promise<IGoalResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const isMember = household.members.some((m) => m.userId?.toString() === userId);
    if (!isMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.findOne({ _id: goalId, householdId: household._id });
    if (!goal) throw NotFoundError('Goal not found');

    return this.formatGoalResponse(goal, household.members);
  }

  // ── Creator OR admin/owner ──────────────────────────────────────────

  async updateGoal(
    householdId: string,
    userId: string,
    goalId: string,
    input: IUpdateGoalInput
  ): Promise<IGoalResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.findOne({ _id: goalId, householdId: household._id });
    if (!goal) throw NotFoundError('Goal not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isCreator = goal.createdByUserId.toString() === userId;
    if (!isCreator && !isAdminOrOwner) {
      throw ForbiddenError('You can only update goals you created');
    }

    if (input.name !== undefined) goal.name = input.name.trim();
    if (input.description !== undefined) goal.description = input.description.trim() || undefined;
    if (input.targetAmount !== undefined) goal.targetAmount = input.targetAmount;
    if (input.category !== undefined) goal.category = input.category;

    // deadline: string sets it, null clears it
    if (input.deadline !== undefined) {
      goal.deadline = input.deadline ? new Date(input.deadline) : undefined;
    }

    // Manual status change (complete / abandon)
    if (input.status && input.status !== goal.status) {
      if (goal.status !== 'active') {
        throw BadRequestError('Only active goals can be completed or abandoned');
      }
      goal.status = input.status;
      goal.completedAt = new Date();
    }

    await goal.save();

    return this.formatGoalResponse(goal, household.members);
  }

  async deleteGoal(
    householdId: string,
    userId: string,
    goalId: string
  ): Promise<void> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.findOne({ _id: goalId, householdId: household._id });
    if (!goal) throw NotFoundError('Goal not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isCreator = goal.createdByUserId.toString() === userId;
    if (!isCreator && !isAdminOrOwner) {
      throw ForbiddenError('You can only delete goals you created');
    }

    await goal.deleteOne();
  }

  // ── Contributions ───────────────────────────────────────────────────

  async addContribution(
    householdId: string,
    userId: string,
    goalId: string,
    input: IAddContributionInput
  ): Promise<IGoalResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.findOne({ _id: goalId, householdId: household._id });
    if (!goal) throw NotFoundError('Goal not found');

    if (goal.status !== 'active') {
      throw BadRequestError('Cannot contribute to a non-active goal');
    }

    goal.contributions.push({
      memberId: requesterMember._id as unknown as Types.ObjectId,
      amount: input.amount,
      ...(input.note?.trim() && { note: input.note.trim() }),
    } as IGoal['contributions'][0]);

    // Auto-complete if target reached
    const currentAmount = this.computeCurrentAmount(goal);
    if (currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
      goal.completedAt = new Date();
    }

    await goal.save();

    return this.formatGoalResponse(goal, household.members);
  }

  async removeContribution(
    householdId: string,
    userId: string,
    goalId: string,
    contributionId: string
  ): Promise<IGoalResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find((m) => m.userId?.toString() === userId);
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const goal = await Goal.findOne({ _id: goalId, householdId: household._id });
    if (!goal) throw NotFoundError('Goal not found');

    const contribution = goal.contributions.find(
      (c) => c._id.toString() === contributionId
    );
    if (!contribution) throw NotFoundError('Contribution not found');

    const isAdminOrOwner = requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isAuthor = contribution.memberId.toString() === requesterMember._id.toString();
    if (!isAuthor && !isAdminOrOwner) {
      throw ForbiddenError('You can only remove your own contributions');
    }

    const wasAutoCompleted = goal.status === 'completed';

    goal.contributions = goal.contributions.filter(
      (c) => c._id.toString() !== contributionId
    ) as typeof goal.contributions;

    // Revert status if was auto-completed and now below target
    if (wasAutoCompleted) {
      const currentAmount = this.computeCurrentAmount(goal);
      if (currentAmount < goal.targetAmount) {
        goal.status = 'active';
        goal.completedAt = undefined;
      }
    }

    await goal.save();

    return this.formatGoalResponse(goal, household.members);
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private computeCurrentAmount(goal: IGoal): number {
    return goal.contributions.reduce((sum, c) => sum + c.amount, 0);
  }

  private formatGoalResponse(
    goal: IGoal,
    members: IHouseholdMember[]
  ): IGoalResponse {
    const memberMap = new Map<string, string>();
    for (const m of members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const contributions: IGoalContributionResponse[] = goal.contributions.map((c) => ({
      _id: c._id.toString(),
      memberId: c.memberId.toString(),
      memberNickname: memberMap.get(c.memberId.toString()) ?? 'Unknown',
      amount: c.amount,
      ...(c.note && { note: c.note }),
      createdAt: c.createdAt.toISOString(),
    }));

    return {
      _id: goal._id.toString(),
      householdId: goal.householdId.toString(),
      name: goal.name,
      ...(goal.description && { description: goal.description }),
      targetAmount: goal.targetAmount,
      currentAmount: this.computeCurrentAmount(goal),
      ...(goal.deadline && { deadline: goal.deadline.toISOString() }),
      status: goal.status,
      ...(goal.category && { category: goal.category }),
      createdByUserId: goal.createdByUserId.toString(),
      ...(goal.completedAt && { completedAt: goal.completedAt.toISOString() }),
      contributions,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }
}

export const goalService = new GoalService();
