import { Types } from 'mongoose';
import { User } from '../../src/models/user.model';
import { Household } from '../../src/models/household.model';

/**
 * Factories produce ad-hoc data WITHIN a test (e.g., a second household to
 * assert cross-household isolation). The seed handles the common case;
 * factories handle the long tail.
 *
 * Field names verified against:
 *   - src/models/user.model.ts
 *   - src/models/household.model.ts
 *   - src/types/household.types.ts
 *
 * Corrections vs the plan's skeleton:
 *   - Household enum 'general' → 'couple' (UI_MODES has no 'general')
 *   - Member ageGroup '26-35' → 'adult' (AGE_GROUPS = child|teenager|adult|senior)
 *   - settings.taskManagementEnabled 'off' → 'disabled' (TASK_MANAGEMENT_LEVELS)
 */

let userCounter = 0;

export const makeUser = async (
  overrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
  }> = {}
) => {
  userCounter += 1;
  const email =
    overrides.email ?? `factory-user-${Date.now()}-${userCounter}@example.com`;
  const user = await new User({
    email,
    password: overrides.password ?? 'Password123!',
    firstName: overrides.firstName ?? `Test${userCounter}`,
    lastName: overrides.lastName ?? 'User',
    isEmailVerified: overrides.isEmailVerified ?? true,
  }).save();
  return user;
};

let householdCounter = 0;

export const makeHousehold = async (
  creatorUserId: Types.ObjectId,
  overrides: Partial<{
    name: string;
    inviteCode: string;
  }> = {}
) => {
  householdCounter += 1;
  const memberId = new Types.ObjectId();
  const household = await new Household({
    name: overrides.name ?? `Factory Household ${householdCounter}`,
    livingArrangement: 'couple',
    totalMembers: 1,
    uiMode: 'couple',
    createdBy: creatorUserId,
    inviteCode:
      overrides.inviteCode ?? `factory-${Date.now()}-${householdCounter}`,
    members: [
      {
        _id: memberId,
        userId: creatorUserId,
        nickname: 'Creator',
        ageGroup: 'adult',
        role: 'owner',
        isCreator: true,
        participatesInFinances: true,
        participatesInTasks: true,
      },
    ],
    settings: {
      currency: 'BGN',
      taskManagementEnabled: 'disabled',
      trackedExpenseTypes: [],
    },
  }).save();
  return { household, creatorMemberId: memberId };
};
