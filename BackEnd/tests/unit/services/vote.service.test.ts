import { describe, it, expect, beforeEach } from 'vitest';
import { voteService } from '../../../src/services/vote.service';
import { Vote } from '../../../src/models/vote.model';
import { VoteBallot } from '../../../src/models/vote-ballot.model';
import { HouseRule } from '../../../src/models/house-rule.model';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';

// Counter to ensure unique seed data per test
let counter = 0;

describe('voteService — tally math', () => {
  let hid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m1: any, m2: any, m3: any, m4: any, m5: any;

  beforeEach(async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;

    m1 = await new User({
      email: `vote-m1-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Owner',
      lastName: 'One',
      isEmailVerified: true,
    }).save();
    m2 = await new User({
      email: `vote-m2-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Member',
      lastName: 'Two',
      isEmailVerified: true,
    }).save();
    m3 = await new User({
      email: `vote-m3-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Member',
      lastName: 'Three',
      isEmailVerified: true,
    }).save();
    m4 = await new User({
      email: `vote-m4-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Member',
      lastName: 'Four',
      isEmailVerified: true,
    }).save();
    m5 = await new User({
      email: `vote-m5-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Member',
      lastName: 'Five',
      isEmailVerified: true,
    }).save();

    const h = await new Household({
      name: 'Vote Test House',
      livingArrangement: 'roommates',
      totalMembers: 5,
      uiMode: 'roommates',
      createdBy: m1._id,
      inviteCode: `vote-invite-${suffix}`,
      members: [
        {
          userId: m1._id,
          nickname: 'M1',
          ageGroup: 'adult',
          role: 'owner',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: true,
        },
        {
          userId: m2._id,
          nickname: 'M2',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: m3._id,
          nickname: 'M3',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: m4._id,
          nickname: 'M4',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: m5._id,
          nickname: 'M5',
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
  });

  async function createOpenVote(
    threshold: 'simple_majority' | 'supermajority' | 'unanimous'
  ) {
    return voteService.createVote(hid, m1._id.toString(), {
      proposedRuleTitle: 'Test Rule',
      proposedRuleText: 'Test rule text',
      threshold,
      deadlineDays: 7,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function cast(vote: any, member: any, choice: 'yes' | 'no' | 'abstain') {
    return voteService.castBallot(
      hid,
      member._id.toString(),
      vote._id.toString(),
      choice
    );
  }

  it('simple_majority passes at 3 yes / 2 no (> 0.5 strict)', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'yes');
    await cast(v, m2, 'yes');
    await cast(v, m3, 'yes');
    await cast(v, m4, 'no');
    await cast(v, m5, 'no');
    const closed = await voteService.closeVoteEarly(
      hid,
      m1._id.toString(),
      v._id.toString()
    );
    expect(closed.status).toBe('passed');
    const rule = await HouseRule.findOne({ sourceVoteId: v._id });
    expect(rule).not.toBeNull();
    expect(rule?.title).toBe('Test Rule');
  });

  it('simple_majority does NOT pass at 2 yes / 2 no (0.5 not strictly >)', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'yes');
    await cast(v, m2, 'yes');
    await cast(v, m3, 'no');
    await cast(v, m4, 'no');
    const closed = await voteService.closeVoteEarly(
      hid,
      m1._id.toString(),
      v._id.toString()
    );
    expect(closed.status).toBe('closed_early');
    const rule = await HouseRule.findOne({ sourceVoteId: v._id });
    expect(rule).toBeNull();
  });

  it('supermajority passes at 4 yes / 1 no (0.8 > 0.667)', async () => {
    const v = await createOpenVote('supermajority');
    await cast(v, m1, 'yes');
    await cast(v, m2, 'yes');
    await cast(v, m3, 'yes');
    await cast(v, m4, 'yes');
    await cast(v, m5, 'no');
    const closed = await voteService.closeVoteEarly(
      hid,
      m1._id.toString(),
      v._id.toString()
    );
    expect(closed.status).toBe('passed');
  });

  it('unanimous fails if any "no" ballot cast', async () => {
    const v = await createOpenVote('unanimous');
    await cast(v, m1, 'yes');
    await cast(v, m2, 'yes');
    await cast(v, m3, 'yes');
    await cast(v, m4, 'yes');
    await cast(v, m5, 'no');
    const closed = await voteService.closeVoteEarly(
      hid,
      m1._id.toString(),
      v._id.toString()
    );
    expect(closed.status).toBe('closed_early');
  });

  it('all-abstain → closed_early, no rule created', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'abstain');
    await cast(v, m2, 'abstain');
    const closed = await voteService.closeVoteEarly(
      hid,
      m1._id.toString(),
      v._id.toString()
    );
    expect(closed.status).toBe('closed_early');
    expect(await HouseRule.findOne({ sourceVoteId: v._id })).toBeNull();
  });

  it('castBallot upserts (change-vote: one ballot per member after multiple casts)', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'yes');
    await cast(v, m1, 'no');
    const ballots = await VoteBallot.find({ voteId: v._id, userId: m1._id });
    expect(ballots).toHaveLength(1);
    expect(ballots[0].choice).toBe('no');
  });

  it('castBallot rejects when past deadline', async () => {
    const v = await createOpenVote('simple_majority');
    await Vote.updateOne(
      { _id: v._id },
      { deadline: new Date(Date.now() - 1000) }
    );
    await expect(cast(v, m1, 'yes')).rejects.toThrow();
  });

  it('autoCloseExpiredVotes — passing vote → status=passed + HouseRule created', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'yes');
    await cast(v, m2, 'yes');
    await cast(v, m3, 'yes');
    await Vote.updateOne(
      { _id: v._id },
      { deadline: new Date(Date.now() - 1000) }
    );
    await voteService.autoCloseExpiredVotes();
    const refreshed = await Vote.findById(v._id);
    expect(refreshed?.status).toBe('passed');
    expect(await HouseRule.findOne({ sourceVoteId: v._id })).not.toBeNull();
  });

  it('autoCloseExpiredVotes — failing vote → status=rejected (not closed_early)', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'no');
    await Vote.updateOne(
      { _id: v._id },
      { deadline: new Date(Date.now() - 1000) }
    );
    await voteService.autoCloseExpiredVotes();
    const refreshed = await Vote.findById(v._id);
    expect(refreshed?.status).toBe('rejected');
  });

  it('closeVoteEarly — admin/owner only', async () => {
    const v = await createOpenVote('simple_majority');
    await cast(v, m1, 'yes');
    // m3 is a regular member — should be forbidden
    await expect(
      voteService.closeVoteEarly(
        hid,
        m3._id.toString(),
        v._id.toString()
      )
    ).rejects.toThrow(/forbidden|admin|owner/i);
  });
});
