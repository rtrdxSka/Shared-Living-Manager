import crypto from 'crypto';
import { User } from '../models/user.model';
import { Household } from '../models/household.model';
import {
  ICreateHouseholdInput,
  IJoinHouseholdInput,
  IHouseholdResponse,
  IHouseholdMemberResponse,
  IHouseholdMember,
  IHousehold,
  ISettlement,
  IUpdateHouseholdSettingsInput,
  determineUIMode,
} from '../types/household.types';
import mongoose, { Types } from 'mongoose';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/error';
import { sendHouseholdInvitationEmail } from '../utils/email';
import { INVITE_CODE_TTL_MS } from '../utils/invite';

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

    // 6. Create household and link user atomically
    const session = await mongoose.startSession();
    session.startTransaction();

    let household;
    try {
      const [created] = await Household.create(
        [
          {
            name: input.householdName,
            livingArrangement: input.livingArrangement,
            ...(input.livingArrangementOther && { livingArrangementOther: input.livingArrangementOther }),
            totalMembers: input.totalMembers,
            uiMode,
            members: [creatorMember, ...placeholderMembers],
            settings,
            createdBy: user._id,
          },
        ],
        { session }
      );
      household = created;

      user.households.push(household._id);
      user.activeHousehold = household._id;
      await user.save({ session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

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
    if (household.inviteCodeExpiresAt && household.inviteCodeExpiresAt < new Date()) {
      throw BadRequestError(
        'This invite code has expired. Ask the household admin to regenerate it.'
      );
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

    // 4. Capacity check: count members linked to a real user vs. configured cap.
    const linkedCount = household.members.filter((m) => m.userId).length;
    if (linkedCount >= household.totalMembers) {
      throw ConflictError(
        `This household is already at full capacity (${household.totalMembers} of ${household.totalMembers} members).`
      );
    }

    // 5. Find placeholder slot matching user's email (case-insensitive, no userId)
    const placeholder = household.members.find(
      (m) => !m.userId && m.email?.toLowerCase() === userEmail.toLowerCase()
    );
    if (!placeholder) {
      throw BadRequestError(
        'Your email is not pre-registered in this household. Contact the household admin to add you.'
      );
    }

    // 6. Link user to placeholder slot and update user atomically
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      placeholder.userId = user._id;
      placeholder.joinedAt = new Date();
      await household.save({ session });

      user.households.push(household._id);
      if (!user.activeHousehold) {
        user.activeHousehold = household._id;
      }
      await user.save({ session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

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

  // ── Update Settings ──────────────────────────────────────────────────

  async updateSettings(
    householdId: string,
    requestingUserId: string,
    input: IUpdateHouseholdSettingsInput
  ): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const member = household.members.find(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!member) throw ForbiddenError('You are not a member of this household');
    if (member.role !== 'owner' && member.role !== 'admin')
      throw ForbiddenError('Only admins can update household settings');

    if (input.financeMode !== undefined) household.settings.financeMode = input.financeMode;
    if (input.expenseSplitMethod !== undefined) household.settings.expenseSplitMethod = input.expenseSplitMethod;
    if (input.customSplitPercentage !== undefined) household.settings.customSplitPercentage = input.customSplitPercentage;
    if (input.customSplitShares !== undefined) household.settings.customSplitShares = input.customSplitShares;

    await household.save();
    return this.formatHouseholdResponse(household);
  }

  // ── Record Settlement ─────────────────────────────────────────────────

  async recordSettlement(
    householdId: string,
    userId: string,
    month: string,
    amount: number
  ): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const member = household.members.find((m) => m.userId?.toString() === userId);
    if (!member) throw ForbiddenError('You are not a member of this household');
    if (!member.participatesInFinances) {
      throw ForbiddenError('Only financial members can record settlements');
    }
    if (member.role !== 'owner' && member.role !== 'admin') {
      throw ForbiddenError('Only admins can record settlements');
    }

    if (household.settlements.find((s) => s.month === month))
      throw BadRequestError('Balance for this month is already marked as settled');

    household.settlements.push({ month, amount, settledByUserId: userId, settledAt: new Date() } as unknown as ISettlement);
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

    // ── Read-path migrations (idempotent, one-time per row) ─────────────
    // C1: legacy 'BGN' settings.currency → 'EUR'.
    // C5: pre-existing households created before invite-expiry shipped get
    //     `inviteCodeExpiresAt` backfilled to `now + 7 days`.
    // Both are coalesced into a single $set so we never double-write.
    const updates: Record<string, unknown> = {};
    if ((household.settings.currency as string) === 'BGN') {
      updates['settings.currency'] = 'EUR';
    }
    if (!household.inviteCodeExpiresAt) {
      updates.inviteCodeExpiresAt = new Date(Date.now() + INVITE_CODE_TTL_MS);
    }
    if (Object.keys(updates).length > 0) {
      await Household.updateOne({ _id: household._id }, { $set: updates });
      if (updates['settings.currency']) {
        household.settings.currency = 'EUR';
      }
      if (updates.inviteCodeExpiresAt) {
        household.inviteCodeExpiresAt = updates.inviteCodeExpiresAt as Date;
      }
    }

    return this.formatHouseholdResponse(household);
  }

  // ── Regenerate Invite Code ───────────────────────────────────────────

  async regenerateInviteCode(householdId: string, requestingUserId: string): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const member = household.members.find(
      (m) => m.userId?.toString() === requestingUserId
    );
    if (!member) throw ForbiddenError('You are not a member of this household');
    if (member.role !== 'owner' && member.role !== 'admin')
      throw ForbiddenError('Only admins can regenerate the invite code');

    household.inviteCode = crypto.randomUUID();
    household.inviteCodeExpiresAt = new Date(Date.now() + INVITE_CODE_TTL_MS);
    await household.save();
    return this.formatHouseholdResponse(household);
  }

  // ── Send Invite Email ────────────────────────────────────────────────

  async sendInviteEmail(
    householdId: string,
    requesterId: string,
    recipientEmail: string,
    personalNote?: string
  ): Promise<void> {
    const household = await Household.findById(householdId);
    if (!household) {
      throw NotFoundError('Household not found');
    }

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === requesterId
    );
    if (
      !requesterMember ||
      (requesterMember.role !== 'owner' && requesterMember.role !== 'admin')
    ) {
      throw ForbiddenError('Only admins can send invite emails');
    }

    if (household.inviteCodeExpiresAt && household.inviteCodeExpiresAt < new Date()) {
      throw BadRequestError(
        'This invite code has expired. Regenerate it before sending a new invite.'
      );
    }

    const requester = await User.findById(requesterId);
    if (!requester) {
      throw NotFoundError('Requesting user not found');
    }

    const expiresAt =
      household.inviteCodeExpiresAt ?? new Date(Date.now() + INVITE_CODE_TTL_MS);

    await sendHouseholdInvitationEmail(
      recipientEmail,
      requester.firstName,
      household.name,
      household.inviteCode,
      expiresAt,
      personalNote
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────

  formatHouseholdResponse(household: IHousehold): IHouseholdResponse {
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
      settlements: (household.settlements ?? []).map((s) => ({
        _id: (s._id as Types.ObjectId).toString(),
        month: s.month,
        amount: s.amount,
        settledByUserId: s.settledByUserId.toString(),
        settledAt: s.settledAt.toISOString(),
      })),
      settings: household.settings,
      createdBy: household.createdBy.toString(),
      inviteCode: household.inviteCode,
      ...(household.inviteCodeExpiresAt && {
        inviteCodeExpiresAt: household.inviteCodeExpiresAt.toISOString(),
      }),
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
