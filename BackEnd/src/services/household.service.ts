import { User } from '../models/user.model';
import { Household } from '../models/household.model';
import {
  ICreateHouseholdInput,
  IHouseholdResponse,
  IHouseholdMemberResponse,
  IHouseholdMember,
  IHousehold,
  determineUIMode,
} from '../types/household.types';
import { NotFoundError } from '../utils/error';

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

      return entry;
    });

    // 5. Build settings
    const settings = {
      trackedExpenseTypes: input.trackedExpenseTypes,
      currency: input.currency,
      taskManagementEnabled: input.taskManagementEnabled,
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
      isCreator: member.isCreator,
      joinedAt: member.joinedAt.toISOString(),
    };
  }
}

export const householdService = new HouseholdService();
