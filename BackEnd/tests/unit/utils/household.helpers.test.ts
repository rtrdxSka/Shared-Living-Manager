import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { getHouseholdForMember } from '../../../src/utils/household.helpers';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

describe('getHouseholdForMember', () => {
  it('returns the household plus the requester member when the user is a member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    const { household, member } = await getHouseholdForMember(
      couple._id.toString(),
      alice._id.toString(),
    );

    expect(household._id.toString()).toBe(couple._id.toString());
    expect(member.userId?.toString()).toBe(alice._id.toString());
  });

  it('resolves the correct member subdocument for a non-creator member (bob in couple)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');

    const { member } = await getHouseholdForMember(
      couple._id.toString(),
      bob._id.toString(),
    );

    expect(member.userId?.toString()).toBe(bob._id.toString());
    expect(member.role).toBe('member');
  });

  it('throws AppError(404) when the household id does not exist', async () => {
    const fakeId = new Types.ObjectId().toString();
    const alice = FIXTURES.user('alice');

    try {
      await getHouseholdForMember(fakeId, alice._id.toString());
      throw new Error('expected getHouseholdForMember to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
      expect((err as AppError).message).toBe('Household not found');
    }
  });

  it('throws AppError(403) when the user is not a member of the household', async () => {
    const couple = FIXTURES.household('couple');
    const carol = FIXTURES.user('carol'); // member of flatshare, not couple

    try {
      await getHouseholdForMember(couple._id.toString(), carol._id.toString());
      throw new Error('expected getHouseholdForMember to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).message).toBe('You are not a member of this household');
    }
  });

  it('throws AppError(403) when the user id is well-formed but unknown', async () => {
    const couple = FIXTURES.household('couple');
    const strangerId = new Types.ObjectId().toString();

    try {
      await getHouseholdForMember(couple._id.toString(), strangerId);
      throw new Error('expected getHouseholdForMember to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });
});
