import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { houseRuleService } from '../../../src/services/house-rule.service';
import { HouseRule } from '../../../src/models/house-rule.model';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';

// Counter used to generate unique emails / invite codes per beforeEach run
let counter = 0;

describe('houseRuleService', () => {
  let hid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let owner: any, member: any;
  let activeRuleId: Types.ObjectId;
  let archivedRuleId: Types.ObjectId;
  const vid = new Types.ObjectId();
  const vid2 = new Types.ObjectId();

  beforeEach(async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;

    owner = await new User({
      email: `rule-owner-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Owner',
      isEmailVerified: true,
    }).save();

    member = await new User({
      email: `rule-member-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Member',
      isEmailVerified: true,
    }).save();

    const h = await new Household({
      name: 'Rule Test House',
      livingArrangement: 'roommates',
      totalMembers: 2,
      uiMode: 'roommates',
      createdBy: owner._id,
      inviteCode: `rule-invite-${suffix}`,
      members: [
        {
          userId: owner._id,
          nickname: 'Alice',
          ageGroup: 'adult',
          role: 'owner',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: true,
        },
        {
          userId: member._id,
          nickname: 'Bob',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
      ],
      settings: {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
        currency: 'BGN',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: [],
      },
    }).save();
    hid = h._id.toString();

    const active = await HouseRule.create({
      householdId: new Types.ObjectId(hid),
      sourceVoteId: vid,
      title: 'A',
      text: 'a',
      passedAt: new Date(),
    });
    const archived = await HouseRule.create({
      householdId: new Types.ObjectId(hid),
      sourceVoteId: vid2,
      title: 'B',
      text: 'b',
      passedAt: new Date(),
      archivedAt: new Date(),
      archivedBy: owner._id,
    });
    activeRuleId = active._id;
    archivedRuleId = archived._id;
  });

  it('lists active rules by default', async () => {
    const res = await houseRuleService.listRules(hid, owner._id.toString(), {});
    expect(res.items).toHaveLength(1);
    expect(res.items[0].title).toBe('A');
  });

  it('includes archived when requested', async () => {
    const res = await houseRuleService.listRules(hid, owner._id.toString(), {
      includeArchived: true,
    });
    expect(res.items).toHaveLength(2);
  });

  it('archiveRule — member forbidden', async () => {
    await expect(
      houseRuleService.archiveRule(
        hid,
        member._id.toString(),
        activeRuleId.toString()
      )
    ).rejects.toThrow(/forbidden|admin|owner/i);
  });

  it('archiveRule — owner sets archivedAt + archivedBy', async () => {
    await houseRuleService.archiveRule(
      hid,
      owner._id.toString(),
      activeRuleId.toString()
    );
    const refreshed = await HouseRule.findById(activeRuleId);
    expect(refreshed?.archivedAt).toBeInstanceOf(Date);
    expect(refreshed?.archivedBy?.toString()).toBe(owner._id.toString());
  });

  it('restoreRule — owner clears archivedAt + archivedBy', async () => {
    await houseRuleService.restoreRule(
      hid,
      owner._id.toString(),
      archivedRuleId.toString()
    );
    const refreshed = await HouseRule.findById(archivedRuleId);
    expect(refreshed?.archivedAt).toBeUndefined();
    expect(refreshed?.archivedBy).toBeUndefined();
  });

  it('restoreRule — member forbidden', async () => {
    await expect(
      houseRuleService.restoreRule(
        hid,
        member._id.toString(),
        archivedRuleId.toString()
      )
    ).rejects.toThrow(/forbidden|admin|owner/i);
  });

  it('archive/restore reject cross-household rules', async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;
    const otherOwner = await new User({
      email: `rule-other-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Other',
      lastName: 'Owner',
      isEmailVerified: true,
    }).save();

    const otherHousehold = await new Household({
      name: 'Other Test House',
      livingArrangement: 'roommates',
      totalMembers: 1,
      uiMode: 'roommates',
      createdBy: otherOwner._id,
      inviteCode: `rule-other-invite-${suffix}`,
      members: [
        {
          userId: otherOwner._id,
          nickname: 'Other',
          ageGroup: 'adult',
          role: 'owner',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: true,
        },
      ],
      settings: {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
        currency: 'BGN',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: [],
      },
    }).save();

    const otherRule = await HouseRule.create({
      householdId: otherHousehold._id,
      sourceVoteId: new Types.ObjectId(),
      title: 'X',
      text: 'X',
      passedAt: new Date(),
    });

    await expect(
      houseRuleService.archiveRule(
        hid,
        owner._id.toString(),
        otherRule._id.toString()
      )
    ).rejects.toThrow();

    await expect(
      houseRuleService.restoreRule(
        hid,
        owner._id.toString(),
        otherRule._id.toString()
      )
    ).rejects.toThrow();
  });
});
