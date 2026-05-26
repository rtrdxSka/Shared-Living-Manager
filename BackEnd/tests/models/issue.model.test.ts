import { describe, it, expect } from 'vitest';
import { Issue } from '../../src/models/issue.model';
import { Types } from 'mongoose';

describe('Issue model', () => {
  it('defaults status=open and upvotedBy=[]', async () => {
    const i = await Issue.create({
      householdId: new Types.ObjectId(),
      authorId: new Types.ObjectId(),
      title: 'Dishes!',
      body: 'someone keeps leaving them in the sink',
      category: 'cleaning',
    });
    const fetched = await Issue.findById(i._id).lean();
    expect(fetched?.status).toBe('open');
    expect(fetched?.upvotedBy).toEqual([]);
  });

  it('rejects title > 120 chars', async () => {
    await expect(Issue.create({
      householdId: new Types.ObjectId(),
      authorId: new Types.ObjectId(),
      title: 'x'.repeat(121),
      body: 'x',
      category: 'cleaning',
    })).rejects.toThrow();
  });

  it('rejects invalid category', async () => {
    await expect(Issue.create({
      householdId: new Types.ObjectId(),
      authorId: new Types.ObjectId(),
      title: 'X',
      body: 'X',
      category: 'invalid_cat' as any,
    })).rejects.toThrow();
  });

  it('escalatedToVoteId stored when set', async () => {
    const voteId = new Types.ObjectId();
    const i = await Issue.create({
      householdId: new Types.ObjectId(),
      authorId: new Types.ObjectId(),
      title: 'X', body: 'X', category: 'cleaning',
      status: 'escalated',
      escalatedToVoteId: voteId,
    });
    const fetched = await Issue.findById(i._id).lean();
    expect(fetched?.escalatedToVoteId?.toString()).toBe(voteId.toString());
    expect(fetched?.status).toBe('escalated');
  });
});
