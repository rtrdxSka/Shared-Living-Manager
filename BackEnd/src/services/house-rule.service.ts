import { Types } from 'mongoose';
import { HouseRule } from '../models/house-rule.model';
import { Household } from '../models/household.model';
import { NotFoundError, ForbiddenError } from '../utils/error';
import type { IHousehold } from '../types/household.types';
import type {
  IHouseRuleResponse,
  IHouseRuleListResponse,
} from '../types/house-rule.types';

interface IListRulesInput {
  includeArchived?: boolean;
}

class HouseRuleService {
  // ── Public API ────────────────────────────────────────────────────────

  async listRules(
    householdId: string,
    userId: string,
    opts: IListRulesInput
  ): Promise<IHouseRuleListResponse> {
    await this.assertMember(householdId, userId);
    const query: Record<string, unknown> = {
      householdId: new Types.ObjectId(householdId),
    };
    if (!opts.includeArchived) {
      query.archivedAt = { $exists: false };
    }
    const rules = await HouseRule.find(query).sort({ passedAt: -1 }).lean();
    return {
      items: rules.map((r) => this.formatRule(r)),
    };
  }

  async archiveRule(
    householdId: string,
    userId: string,
    ruleId: string
  ): Promise<IHouseRuleResponse> {
    await this.assertAdmin(householdId, userId);
    const rule = await HouseRule.findOne({
      _id: ruleId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!rule) throw NotFoundError('House rule not found');
    rule.archivedAt = new Date();
    rule.archivedBy = new Types.ObjectId(userId);
    await rule.save();
    return this.formatRule(rule.toObject());
  }

  async restoreRule(
    householdId: string,
    userId: string,
    ruleId: string
  ): Promise<IHouseRuleResponse> {
    await this.assertAdmin(householdId, userId);
    const rule = await HouseRule.findOne({
      _id: ruleId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!rule) throw NotFoundError('House rule not found');
    rule.archivedAt = undefined;
    rule.archivedBy = undefined;
    await rule.save();
    return this.formatRule(rule.toObject());
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async assertMember(
    householdId: string,
    userId: string
  ): Promise<{ household: IHousehold }> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');
    const isMember = household.members.some(
      (m) => m.userId?.toString() === userId
    );
    if (!isMember) throw ForbiddenError('Not a household member');
    return { household };
  }

  private async assertAdmin(
    householdId: string,
    userId: string
  ): Promise<{ household: IHousehold }> {
    const { household } = await this.assertMember(householdId, userId);
    const role = household.members.find(
      (m) => m.userId?.toString() === userId
    )?.role;
    if (role !== 'owner' && role !== 'admin') {
      throw ForbiddenError('Admin or owner required');
    }
    return { household };
  }

  private formatRule(r: {
    _id: Types.ObjectId;
    householdId: Types.ObjectId;
    sourceVoteId: Types.ObjectId;
    title: string;
    text: string;
    passedAt: Date;
    archivedAt?: Date;
    archivedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }): IHouseRuleResponse {
    return {
      _id: r._id.toString(),
      householdId: r.householdId.toString(),
      sourceVoteId: r.sourceVoteId.toString(),
      title: r.title,
      text: r.text,
      passedAt: r.passedAt.toISOString(),
      ...(r.archivedAt && { archivedAt: r.archivedAt.toISOString() }),
      ...(r.archivedBy && { archivedBy: r.archivedBy.toString() }),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

export const houseRuleService = new HouseRuleService();
