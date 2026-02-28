import { User } from '../models/user.model';
import { Household } from '../models/household.model';
import {
  ICreateHouseholdInput,
  IJoinHouseholdInput,
  IHouseholdResponse,
  IHouseholdMemberResponse,
  IHouseholdMember,
  IHousehold,
  determineUIMode,
} from '../types/household.types';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/error';

class HouseholdService {
  // ── Create from Onboarding ──────────────────────────────────────────

  async createFromOnboarding(
    userId: string,
    input: ICreateHouseholdInput
  ): Promise<IHouseholdResponse> {
    // 1. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw NotFoundError('User not found');
    }

    // 2. Derive UI mode
    const uiMode = determineUIMode(input.livingArrangement, input.totalMembers);

    // 3. Build creator member
    const creatorMember: Partial<IHouseholdMember> = {
      userId: user._id,
      nickname: input.creatorProfile.nickname,
      ageGroup: input.creatorProfile.ageGroup,
      role: 'owner',
      participatesInFinances: input.creatorProfile.participatesInFinances,
      participatesInTasks: input.creatorProfile.participatesInTasks,
      isCreator: true,
      joinedAt: new Date(),
    };

    if (input.creatorProfile.familyGroup) {
      creatorMember.familyGroup = input.creatorProfile.familyGroup;
    }

    creatorMember.email = user.email;

    // 4. Build placeholder members (no userId — join later via invite)
    const placeholderMembers = input.memberStructure.map((member) => {
      const entry: Partial<IHouseholdMember> = {
        nickname: member.nickname,
        relationship: member.relationship,
        ageGroup: member.ageGroup,
        role: 'member',
        participatesInFinances: member.participatesInFinances,
        participatesInTasks: member.participatesInTasks,
        isCreator: false,
        joinedAt: new Date(),
      };

      if (member.familyGroup) {
        entry.familyGroup = member.familyGroup;
      }

      entry.email = member.email;

      return entry;
    });

    // 5. Build settings
    const settings = {
      trackedExpenseTypes: input.trackedExpenseTypes,
      currency: input.currency,
      taskManagementEnabled: input.taskManagementEnabled,
      ...(input.financeMode && { financeMode: input.financeMode }),
      ...(input.expenseSplitMethod && { expenseSplitMethod: input.expenseSplitMethod }),
      ...(input.taskDistributionMethod && { taskDistributionMethod: input.taskDistributionMethod }),
    };

    // 6. Create household document
    // TODO: wrap in MongoDB transaction for production
    const household = await Household.create({
      name: input.householdName,
      livingArrangement: input.livingArrangement,
      ...(input.livingArrangementOther && { livingArrangementOther: input.livingArrangementOther }),
      totalMembers: input.totalMembers,
      uiMode,
      members: [creatorMember, ...placeholderMembers],
      settings,
      createdBy: user._id,
    });

    // 7. Update user: link household
    user.households.push(household._id);
    user.activeHousehold = household._id;
    await user.save();

    return this.formatHouseholdResponse(household);
  }

  // ── Join Household ────────────────────────────────────────────────────

  async joinHousehold(
    userId: string,
    userEmail: string,
    input: IJoinHouseholdInput
  ): Promise<IHouseholdResponse> {
    // 1. Find household by invite code
    const household = await Household.findOne({ inviteCode: input.inviteCode });
    if (!household) {
      throw NotFoundError('Invalid invite code');
    }

    // 2. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw NotFoundError('User not found');
    }

    // 3. Check user isn't already a member
    const existingMember = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (existingMember) {
      throw ConflictError('You are already a member of this household');
    }

    // 4. Find placeholder slot matching user's email (case-insensitive, no userId)
    const placeholder = household.members.find(
      (m) => !m.userId && m.email?.toLowerCase() === userEmail.toLowerCase()
    );
    if (!placeholder) {
      throw BadRequestError(
        'Your email is not pre-registered in this household. Contact the household admin to add you.'
      );
    }

    // 5. Link user to placeholder slot
    placeholder.userId = user._id;
    placeholder.joinedAt = new Date();
    await household.save();

    // 6. Update user: link household
    user.households.push(household._id);
    if (!user.activeHousehold) {
      user.activeHousehold = household._id;
    }
    await user.save();

    return this.formatHouseholdResponse(household);
  }

  // ── Update Member Income ─────────────────────────────────────────────

  async updateMemberIncome(
    householdId: string,
    userId: string,
    income: number
  ): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    const member = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (!member) {
      throw ForbiddenError('You are not a member of this household');
    }

    member.monthlyIncome = income;
    await household.save();

    return this.formatHouseholdResponse(household);
  }

  // ── Get by ID ────────────────────────────────────────────────────────

  async getById(householdId: string, userId: string): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    // Verify the requesting user is a member
    const isMember = household.members.some(
      (m) => m.userId?.toString() === userId
    );
    if (!isMember) {
      throw ForbiddenError('You are not a member of this household');
    }

    return this.formatHouseholdResponse(household);
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private formatHouseholdResponse(household: IHousehold): IHouseholdResponse {
    return {
      _id: household._id.toString(),
      name: household.name,
      livingArrangement: household.livingArrangement,
      ...(household.livingArrangementOther && {
        livingArrangementOther: household.livingArrangementOther,
      }),
      totalMembers: household.totalMembers,
      uiMode: household.uiMode,
      members: household.members.map((m) => this.formatMemberResponse(m)),
      settings: household.settings,
      createdBy: household.createdBy.toString(),
      inviteCode: household.inviteCode,
      createdAt: household.createdAt.toISOString(),
      updatedAt: household.updatedAt.toISOString(),
    };
  }

  private formatMemberResponse(member: IHouseholdMember & { _id?: { toString(): string } }): IHouseholdMemberResponse {
    return {
      _id: member._id?.toString() ?? '',
      ...(member.userId && { userId: member.userId.toString() }),
      nickname: member.nickname,
      ...(member.relationship && { relationship: member.relationship }),
      ageGroup: member.ageGroup,
      role: member.role,
      participatesInFinances: member.participatesInFinances,
      participatesInTasks: member.participatesInTasks,
      ...(member.familyGroup && { familyGroup: member.familyGroup }),
      ...(member.email && { email: member.email }),
      isCreator: member.isCreator,
      joinedAt: member.joinedAt.toISOString(),
      ...(member.monthlyIncome !== undefined && { monthlyIncome: member.monthlyIncome }),
    };
  }
}

export const householdService = new HouseholdService();
