import { Household } from '../models/household.model';
import type { IHousehold, IHouseholdMember } from '../types/household.types';
import { NotFoundError, ForbiddenError } from './error';

/**
 * Load just the fields needed to validate household membership (including
 * settings + settlements for callers that read them), without paying the
 * cost of Mongoose document hydration on read-only paths. Use this ONLY
 * when the caller does not need to call `.save()` or mutate the doc.
 *
 * Returns the lean household plus the requester's member subdocument.
 *
 * Throws:
 *   - NotFoundError('Household not found') when the id does not exist.
 *   - ForbiddenError('You are not a member of this household') when the
 *     authenticated user is not a member.
 */
export async function getHouseholdForMember(
  householdId: string,
  userId: string
): Promise<{ household: IHousehold; member: IHouseholdMember }> {
  const household = await Household.findById(householdId)
    .select('name livingArrangement livingArrangementOther totalMembers uiMode members settlements settings createdBy inviteCode createdAt updatedAt')
    .lean<IHousehold>();
  if (!household) throw NotFoundError('Household not found');

  const member = household.members.find((m) => m.userId?.toString() === userId);
  if (!member) throw ForbiddenError('You are not a member of this household');

  return { household, member };
}
