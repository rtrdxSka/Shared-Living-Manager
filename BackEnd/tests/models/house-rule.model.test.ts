import { describe, it, expect } from 'vitest';
import { HouseRule } from '../../src/models/house-rule.model';
import { Types } from 'mongoose';

describe('HouseRule model', () => {
  it('stores active rule with archivedAt undefined by default', async () => {
    const r = await HouseRule.create({
      householdId: new Types.ObjectId(),
      sourceVoteId: new Types.ObjectId(),
      title: 'Dishes 24h',
      text: 'Each person cleans their dishes within 24h',
      passedAt: new Date(),
    });
    const fetched = await HouseRule.findById(r._id).lean();
    expect(fetched?.archivedAt).toBeUndefined();
    expect(fetched?.archivedBy).toBeUndefined();
    expect(fetched?.title).toBe('Dishes 24h');
  });

  it('round-trips archivedAt + archivedBy', async () => {
    const archiver = new Types.ObjectId();
    const r = await HouseRule.create({
      householdId: new Types.ObjectId(),
      sourceVoteId: new Types.ObjectId(),
      title: 'X', text: 'X',
      passedAt: new Date(),
      archivedAt: new Date(),
      archivedBy: archiver,
    });
    const fetched = await HouseRule.findById(r._id).lean();
    expect(fetched?.archivedAt).toBeInstanceOf(Date);
    expect(fetched?.archivedBy?.toString()).toBe(archiver.toString());
  });

  it('rejects missing sourceVoteId', async () => {
    await expect(HouseRule.create({
      householdId: new Types.ObjectId(),
      title: 'X', text: 'X', passedAt: new Date(),
    } as any)).rejects.toThrow();
  });

  it('rejects title > 120 chars', async () => {
    await expect(HouseRule.create({
      householdId: new Types.ObjectId(),
      sourceVoteId: new Types.ObjectId(),
      title: 'x'.repeat(121), text: 'x', passedAt: new Date(),
    })).rejects.toThrow();
  });
});
