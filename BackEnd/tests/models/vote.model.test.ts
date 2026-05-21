import { describe, it, expect, beforeAll } from 'vitest';
import { Vote } from '../../src/models/vote.model';
import { VoteBallot } from '../../src/models/vote-ballot.model';
import { Types } from 'mongoose';

describe('Vote model', () => {
  it('defaults threshold=simple_majority and status=open', async () => {
    const v = await Vote.create({
      householdId: new Types.ObjectId(),
      proposedRuleTitle: 'Dishes 24h',
      proposedRuleText: 'Clean within 24h',
      proposedBy: new Types.ObjectId(),
      deadline: new Date(Date.now() + 7 * 86400_000),
    });
    const fetched = await Vote.findById(v._id).lean();
    expect(fetched?.threshold).toBe('simple_majority');
    expect(fetched?.status).toBe('open');
  });

  it('rejects invalid threshold', async () => {
    await expect(Vote.create({
      householdId: new Types.ObjectId(),
      proposedRuleTitle: 'X', proposedRuleText: 'X',
      proposedBy: new Types.ObjectId(),
      threshold: 'invalid' as never,
      deadline: new Date(Date.now() + 86400_000),
    })).rejects.toThrow();
  });

  it('rejects proposedRuleTitle > 120 chars', async () => {
    await expect(Vote.create({
      householdId: new Types.ObjectId(),
      proposedRuleTitle: 'x'.repeat(121),
      proposedRuleText: 'x',
      proposedBy: new Types.ObjectId(),
      deadline: new Date(Date.now() + 86400_000),
    })).rejects.toThrow();
  });
});

describe('VoteBallot model', () => {
  beforeAll(async () => {
    // Ensure the unique compound index is built before the duplicate-key test runs.
    await VoteBallot.syncIndexes();
  });

  it('rejects duplicate (voteId, userId) ballot via unique index', async () => {
    const voteId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await VoteBallot.create({ voteId, userId, choice: 'yes' });
    await expect(
      VoteBallot.create({ voteId, userId, choice: 'no' })
    ).rejects.toThrow(/duplicate|E11000/i);
  });

  it('rejects invalid choice', async () => {
    await expect(VoteBallot.create({
      voteId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      choice: 'maybe' as never,
    })).rejects.toThrow();
  });

  it('upsert change-vote pattern works', async () => {
    const voteId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await VoteBallot.findOneAndUpdate(
      { voteId, userId },
      { voteId, userId, choice: 'yes', castAt: new Date() },
      { upsert: true, new: true }
    );
    await VoteBallot.findOneAndUpdate(
      { voteId, userId },
      { voteId, userId, choice: 'no', castAt: new Date() },
      { upsert: true, new: true }
    );
    const ballots = await VoteBallot.find({ voteId, userId });
    expect(ballots).toHaveLength(1);
    expect(ballots[0].choice).toBe('no');
  });
});
