import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { householdService } from '../../../src/services/household.service';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';
import { AppError } from '../../../src/utils/error';
import { INVITE_CODE_TTL_MS } from '../../../src/utils/invite';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';
import type { ICreateHouseholdInput } from '../../../src/types/household.types';

// ── Helpers ──────────────────────────────────────────────────────────
// `NotFoundError`, `BadRequestError`, etc. are arrow-function factories — not
// classes. We can't `instanceof` against them. Match against AppError + statusCode.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

const validCreateInput = (
  overrides: Partial<ICreateHouseholdInput> = {}
): ICreateHouseholdInput => ({
  householdName: 'Factory Household',
  totalMembers: 2,
  livingArrangement: 'couple',
  creatorProfile: {
    nickname: 'Creator',
    ageGroup: 'adult',
    participatesInFinances: true,
    participatesInTasks: true,
  },
  memberStructure: [
    {
      nickname: 'Partner',
      relationship: 'partner',
      ageGroup: 'adult',
      participatesInFinances: true,
      participatesInTasks: true,
      email: 'partner-placeholder@example.com',
    },
  ],
  trackedExpenseTypes: ['rent', 'groceries'],
  currency: 'BGN',
  taskManagementEnabled: 'basic',
  ...overrides,
});

// ── createFromOnboarding ─────────────────────────────────────────────

describe('householdService.createFromOnboarding', () => {
  it('creates a household with the creator linked as the owner member', async () => {
    const creator = await makeUser({ email: 'create-onboard-1@example.com' });

    const result = await householdService.createFromOnboarding(
      creator._id.toString(),
      validCreateInput({ householdName: 'Onboarding Test' })
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.name).toBe('Onboarding Test');
    expect(result.uiMode).toBe('couple');
    expect(result.members).toHaveLength(2);

    // Creator slot is linked to the user; placeholder slot is unlinked.
    const creatorMember = result.members.find((m) => m.isCreator);
    expect(creatorMember).toBeDefined();
    expect(creatorMember!.userId).toBe(creator._id.toString());
    expect(creatorMember!.role).toBe('owner');
    expect(creatorMember!.email).toBe(creator.email);

    const placeholder = result.members.find((m) => !m.isCreator);
    expect(placeholder).toBeDefined();
    expect(placeholder!.userId).toBeUndefined();
    expect(placeholder!.email).toBe('partner-placeholder@example.com');
    expect(placeholder!.role).toBe('member');
  });

  it('atomically backfills User.households and activeHousehold', async () => {
    const creator = await makeUser({ email: 'create-onboard-2@example.com' });
    expect(creator.households).toHaveLength(0);
    expect(creator.activeHousehold).toBeUndefined();

    const result = await householdService.createFromOnboarding(
      creator._id.toString(),
      validCreateInput()
    );

    const refreshed = await User.findById(creator._id).lean();
    expect(refreshed?.households.map((h) => h.toString())).toContain(result._id);
    expect(refreshed?.activeHousehold?.toString()).toBe(result._id);
  });
});

// ── joinHousehold ────────────────────────────────────────────────────

describe('householdService.joinHousehold', () => {
  it('links a user to a placeholder slot whose email matches', async () => {
    // 1. Owner creates a household with a placeholder slot for joiner@…
    const owner = await makeUser({ email: 'join-owner-1@example.com' });
    const created = await householdService.createFromOnboarding(
      owner._id.toString(),
      validCreateInput({
        householdName: 'Joinable',
        memberStructure: [
          {
            nickname: 'Joiner',
            relationship: 'partner',
            ageGroup: 'adult',
            participatesInFinances: true,
            participatesInTasks: true,
            email: 'joiner-1@example.com',
          },
        ],
      })
    );

    const inviteCode = (await Household.findById(created._id))!.inviteCode;

    // 2. The joiner registers and joins via invite code.
    const joiner = await makeUser({ email: 'joiner-1@example.com' });
    const result = await householdService.joinHousehold(
      joiner._id.toString(),
      joiner.email,
      { inviteCode }
    );

    expect(result._id).toBe(created._id);
    const joinerMember = result.members.find(
      (m) => m.userId === joiner._id.toString()
    );
    expect(joinerMember).toBeDefined();
    expect(joinerMember!.email).toBe('joiner-1@example.com');

    // user.households should be updated.
    const refreshed = await User.findById(joiner._id).lean();
    expect(refreshed?.households.map((h) => h.toString())).toContain(created._id);
    expect(refreshed?.activeHousehold?.toString()).toBe(created._id);
  });

  it('throws NotFound (404) when the invite code is invalid', async () => {
    const user = await makeUser({ email: 'join-bad-code@example.com' });
    await expect(
      householdService.joinHousehold(user._id.toString(), user.email, {
        inviteCode: 'totally-not-a-real-code',
      })
    ).rejects.toSatisfy(expectAppError(404));
  });

  it('throws BadRequest (400) when the user email is not pre-registered as a placeholder', async () => {
    const owner = await makeUser({ email: 'join-owner-3@example.com' });
    const created = await householdService.createFromOnboarding(
      owner._id.toString(),
      validCreateInput({
        householdName: 'Owner Plus Slot',
        memberStructure: [
          {
            nickname: 'ExpectedJoiner',
            relationship: 'partner',
            ageGroup: 'adult',
            participatesInFinances: true,
            participatesInTasks: true,
            email: 'expected-3@example.com',
          },
        ],
      })
    );
    const inviteCode = (await Household.findById(created._id))!.inviteCode;

    // A different user (not in placeholder list) tries to join.
    const stranger = await makeUser({ email: 'stranger-3@example.com' });
    await expect(
      householdService.joinHousehold(
        stranger._id.toString(),
        stranger.email,
        { inviteCode }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('throws Conflict (409) when the user is already a member', async () => {
    // Bob is already a member of the couple household; trying to re-join must conflict.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    await expect(
      householdService.joinHousehold(bob._id.toString(), bob.email, {
        inviteCode: couple.inviteCode,
      })
    ).rejects.toSatisfy(expectAppError(409));
  });
});

// ── updateMemberIncome ───────────────────────────────────────────────

describe('householdService.updateMemberIncome', () => {
  it('updates monthlyIncome for the calling user', async () => {
    // Use frank in the flatshare household — he's not used by other tests in this file.
    const flatshare = FIXTURES.household('flatshare');
    const frank = FIXTURES.user('frank');

    const result = await householdService.updateMemberIncome(
      flatshare._id.toString(),
      frank._id.toString(),
      4242
    );

    const frankMember = result.members.find(
      (m) => m.userId === frank._id.toString()
    );
    expect(frankMember).toBeDefined();
    expect(frankMember!.monthlyIncome).toBe(4242);
  });
});

// ── updateSettings ───────────────────────────────────────────────────

describe('householdService.updateSettings', () => {
  it('admin (owner) can change financeMode to joint', async () => {
    // Carol owns flatshare. flatshare currently has financeMode: 'split'.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');

    const result = await householdService.updateSettings(
      flatshare._id.toString(),
      carol._id.toString(),
      { financeMode: 'joint' }
    );

    expect(result.settings.financeMode).toBe('joint');
  });

  it('non-admin member is denied (Forbidden 403)', async () => {
    // Frank is a plain member of flatshare.
    const flatshare = FIXTURES.household('flatshare');
    const frank = FIXTURES.user('frank');

    await expect(
      householdService.updateSettings(
        flatshare._id.toString(),
        frank._id.toString(),
        { financeMode: 'split' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('persists per-member customSplitShares (roommate custom split)', async () => {
    // flatshare's finance members are carol (owner), eve (admin), frank (member).
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const shares = [
      { userId: carol._id.toString(), pct: 50 },
      { userId: FIXTURES.user('eve')._id.toString(), pct: 30 },
      { userId: FIXTURES.user('frank')._id.toString(), pct: 20 },
    ];

    const result = await householdService.updateSettings(
      flatshare._id.toString(),
      carol._id.toString(),
      { expenseSplitMethod: 'custom', customSplitShares: shares }
    );

    expect(result.settings.customSplitShares).toHaveLength(3);
    const sum = (result.settings.customSplitShares ?? []).reduce((acc, s) => acc + s.pct, 0);
    expect(sum).toBe(100);
    expect(result.settings.customSplitShares?.[0].userId.toString()).toBe(shares[0].userId);
  });
});

// ── recordSettlement ─────────────────────────────────────────────────

describe('householdService.recordSettlement', () => {
  it('admin can record a monthly settlement', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await householdService.recordSettlement(
      couple._id.toString(),
      alice._id.toString(),
      '2026-01',
      150.5
    );

    const settlement = result.settlements.find((s) => s.month === '2026-01');
    expect(settlement).toBeDefined();
    expect(settlement!.amount).toBe(150.5);
    expect(settlement!.settledByUserId).toBe(alice._id.toString());
  });

  it('non-admin member is denied (Forbidden 403)', async () => {
    // Bob is a plain member (participatesInFinances true) of the couple — should be forbidden.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');

    await expect(
      householdService.recordSettlement(
        couple._id.toString(),
        bob._id.toString(),
        '2026-02',
        100
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('throws BadRequest (400) on double-settlement of the same month', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    // First settlement should succeed.
    await householdService.recordSettlement(
      couple._id.toString(),
      alice._id.toString(),
      '2026-03',
      75
    );
    // Same month again must error.
    await expect(
      householdService.recordSettlement(
        couple._id.toString(),
        alice._id.toString(),
        '2026-03',
        80
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── getById ──────────────────────────────────────────────────────────

describe('householdService.getById', () => {
  it('a member can fetch their household', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await householdService.getById(
      couple._id.toString(),
      alice._id.toString()
    );

    expect(result._id).toBe(couple._id.toString());
    expect(result.members.some((m) => m.userId === alice._id.toString())).toBe(true);
  });

  it('a non-member is denied (Forbidden 403)', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = await makeUser({ email: 'stranger-getbyid@example.com' });
    await expect(
      householdService.getById(couple._id.toString(), stranger._id.toString())
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('throws NotFound (404) when the household does not exist', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      householdService.getById(
        new Types.ObjectId().toString(),
        alice._id.toString()
      )
    ).rejects.toSatisfy(expectAppError(404));
  });

  it('migrates legacy BGN currency to EUR on read and persists the change', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.currency': 'BGN' } }
    );

    const result = await householdService.getById(
      couple._id.toString(),
      alice._id.toString()
    );

    expect(result.settings.currency).toBe('EUR');

    const reloaded = await Household.findById(couple._id).lean();
    expect(reloaded?.settings.currency).toBe('EUR');
  });

  it('backfills missing inviteCodeExpiresAt to now + 7 days on read', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await Household.updateOne(
      { _id: couple._id },
      { $unset: { inviteCodeExpiresAt: 1 } }
    );

    const before = Date.now();
    const result = await householdService.getById(
      couple._id.toString(),
      alice._id.toString()
    );
    const after = Date.now();

    expect(result.inviteCodeExpiresAt).toBeDefined();
    const expiresMs = new Date(result.inviteCodeExpiresAt!).getTime();
    const expectedLower = before + INVITE_CODE_TTL_MS - 5000;
    const expectedUpper = after + INVITE_CODE_TTL_MS + 5000;
    expect(expiresMs).toBeGreaterThanOrEqual(expectedLower);
    expect(expiresMs).toBeLessThanOrEqual(expectedUpper);
  });
});

// ── regenerateInviteCode ─────────────────────────────────────────────

describe('householdService.regenerateInviteCode', () => {
  it('admin (owner) can regenerate the invite code', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const oldCode = couple.inviteCode;

    const result = await householdService.regenerateInviteCode(
      couple._id.toString(),
      alice._id.toString()
    );

    expect(result.inviteCode).toBeTypeOf('string');
    expect(result.inviteCode).not.toBe(oldCode);
    expect(result.inviteCode.length).toBeGreaterThan(0);
  });

  it('non-admin member is denied (Forbidden 403)', async () => {
    // Frank is a plain member of flatshare.
    const flatshare = FIXTURES.household('flatshare');
    const frank = FIXTURES.user('frank');
    await expect(
      householdService.regenerateInviteCode(
        flatshare._id.toString(),
        frank._id.toString()
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('regenerateInviteCode resets the expiry to now + 7 days', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    const before = Date.now();
    const result = await householdService.regenerateInviteCode(
      couple._id.toString(),
      alice._id.toString()
    );
    const after = Date.now();

    expect(result.inviteCodeExpiresAt).toBeDefined();
    const expiresMs = new Date(result.inviteCodeExpiresAt!).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + INVITE_CODE_TTL_MS - 5000);
    expect(expiresMs).toBeLessThanOrEqual(after + INVITE_CODE_TTL_MS + 5000);
  });
});
