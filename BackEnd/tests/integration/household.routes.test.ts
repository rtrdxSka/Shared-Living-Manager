import { describe, it, expect, vi, beforeEach } from 'vitest';

import request from 'supertest';
import { Types } from 'mongoose';
import app from '../../src/index';
import { Household } from '../../src/models/household.model';
import * as emailMod from '../../src/utils/email';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { makeUser } from '../helpers/factories';

const auth = (userId: string, email?: string) =>
  `Bearer ${signTestJwt(userId, email)}`;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reality-vs-plan corrections:
 *   - ageGroup '26-35' → 'adult' (AGE_GROUPS = child|teenager|adult|senior)
 *   - memberStructure.*.relationship is REQUIRED by the validator (omitted in plan)
 *   - Plan asserted res.body.data.household.name — confirmed correct.
 *   - household.routes mounts joinHouseholdValidation which uses isUUID() on
 *     inviteCode, so a non-UUID code returns 400, not 404 (see test below).
 */
const validCreateBody = (overrides: Record<string, unknown> = {}) => ({
  householdName: 'Route-Test Household',
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
  trackedExpenseTypes: ['rent'],
  currency: 'BGN',
  taskManagementEnabled: 'basic',
  financeMode: 'joint',
  ...overrides,
});

describe('POST /api/households', () => {
  it('returns 201 with valid body', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households')
      .set('Authorization', auth(u._id.toString(), u.email))
      .send(validCreateBody());
    expect(res.status).toBe(201);
    expect(res.body.data.household.name).toBe('Route-Test Household');
    expect(res.body.data.household.inviteCode).toMatch(UUID_V4_REGEX);
  });

  it('returns 400 on missing required fields', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households')
      .set('Authorization', auth(u._id.toString(), u.email))
      .send({ householdName: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/households/join', () => {
  it('returns 200 with valid invite + matching email', async () => {
    const joinerEmail = `joiner-${Date.now()}@example.com`;
    const joiner = await makeUser({ email: joinerEmail });

    // Create a household with the joiner's email pre-registered.
    const owner = await makeUser();
    const created = await request(app)
      .post('/api/households')
      .set('Authorization', auth(owner._id.toString(), owner.email))
      .send(
        validCreateBody({
          memberStructure: [
            {
              nickname: 'TheJoiner',
              relationship: 'partner',
              ageGroup: 'adult',
              participatesInFinances: true,
              participatesInTasks: true,
              email: joinerEmail,
            },
          ],
        })
      );
    expect(created.status).toBe(201);

    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(joiner._id.toString(), joiner.email))
      .send({ inviteCode: created.body.data.household.inviteCode });
    expect(res.status).toBe(200);
    expect(
      res.body.data.household.members.some(
        (m: { userId?: string }) => m.userId === joiner._id.toString()
      )
    ).toBe(true);
  });

  it('returns 400 when joining email does not match any placeholder slot', async () => {
    // Owner creates a household with a placeholder slot tied to a specific email.
    const placeholderEmail = `placeholder-${Date.now()}@example.com`;
    const owner = await makeUser();
    const created = await request(app)
      .post('/api/households')
      .set('Authorization', auth(owner._id.toString(), owner.email))
      .send(
        validCreateBody({
          memberStructure: [
            {
              nickname: 'TheSlot',
              relationship: 'partner',
              ageGroup: 'adult',
              participatesInFinances: true,
              participatesInTasks: true,
              email: placeholderEmail,
            },
          ],
        })
      );
    expect(created.status).toBe(201);

    // A different authenticated user attempts to join.
    const stranger = await makeUser({
      email: `stranger-${Date.now()}@example.com`,
    });
    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(stranger._id.toString(), stranger.email))
      .send({ inviteCode: created.body.data.household.inviteCode });
    expect(res.status).toBe(400);
  });

  it('returns 409 when user is already a member', async () => {
    // The seeded `couple.inviteCode` is a fixture string, not a UUID, so the
    // join validator (isUUID) would reject it with 400 before the service
    // runs. Regenerate via the admin endpoint to get a real UUID, then have
    // bob (already a member of `couple`) attempt to join — that path goes
    // through the service and yields ConflictError → 409.
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');

    const regen = await request(app)
      .patch(`/api/households/${couple._id}/invite-code`)
      .set('Authorization', auth(alice._id.toString(), alice.email));
    expect(regen.status).toBe(200);
    const uuidInviteCode = regen.body.data.household.inviteCode;

    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(bob._id.toString(), bob.email))
      .send({ inviteCode: uuidInviteCode });
    expect(res.status).toBe(409);
  });

  it('rejects join with an expired invite code', async () => {
    // Build a household with a placeholder slot for the joiner, then force
    // the invite to be expired by setting `inviteCodeExpiresAt` to the past.
    const joinerEmail = `expired-joiner-${Date.now()}@example.com`;
    const joiner = await makeUser({ email: joinerEmail });
    const owner = await makeUser();
    const created = await request(app)
      .post('/api/households')
      .set('Authorization', auth(owner._id.toString(), owner.email))
      .send(
        validCreateBody({
          memberStructure: [
            {
              nickname: 'TheJoiner',
              relationship: 'partner',
              ageGroup: 'adult',
              participatesInFinances: true,
              participatesInTasks: true,
              email: joinerEmail,
            },
          ],
        })
      );
    expect(created.status).toBe(201);

    await Household.updateOne(
      { _id: new Types.ObjectId(created.body.data.household._id as string) },
      { $set: { inviteCodeExpiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(joiner._id.toString(), joiner.email))
      .send({ inviteCode: created.body.data.household.inviteCode });

    expect([400, 410]).toContain(res.status);
    const messageText =
      (res.body as { error?: { message?: string }; message?: string }).error?.message ??
      (res.body as { message?: string }).message ??
      '';
    expect(messageText).toMatch(/expired/i);
  });

  it('returns 400 on invalid invite-code format (validator rejects non-UUID)', async () => {
    // Plan called for 404, but joinHouseholdValidation requires isUUID()
    // and runs BEFORE the service, so a non-UUID string is rejected at the
    // validator layer with 400.
    const u = await makeUser();
    const res = await request(app)
      .post('/api/households/join')
      .set('Authorization', auth(u._id.toString(), u.email))
      .send({ inviteCode: 'definitely-not-a-real-code' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/households/:id', () => {
  it('returns 200 for a member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}`)
      .set('Authorization', auth(alice._id.toString(), alice.email));
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-member', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}`)
      .set('Authorization', auth(carol._id.toString(), carol.email));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent household', async () => {
    const alice = FIXTURES.user('alice');
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app)
      .get(`/api/households/${missingId}`)
      .set('Authorization', auth(alice._id.toString(), alice.email));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/households/:id/settings', () => {
  it('admin can update (200)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ financeMode: 'split' });
    expect(res.status).toBe(200);
    expect(res.body.data.household.settings.financeMode).toBe('split');
  });

  it('non-admin returns 403', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(bob._id.toString(), bob.email))
      .send({ financeMode: 'split' });
    expect(res.status).toBe(403);
  });

  it('rejects customSplitShares that do not sum to 100 (400)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({
        expenseSplitMethod: 'custom',
        customSplitShares: [
          { userId: alice._id.toString(), pct: 50 },
          { userId: FIXTURES.user('bob')._id.toString(), pct: 30 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('accepts customSplitShares that sum to 100 (200)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/settings`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({
        expenseSplitMethod: 'custom',
        customSplitShares: [
          { userId: alice._id.toString(), pct: 60 },
          { userId: FIXTURES.user('bob')._id.toString(), pct: 40 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.household.settings.customSplitShares).toHaveLength(2);
  });
});

describe('PATCH /api/households/:id/members/me/income', () => {
  it('returns 200 with valid income', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/members/me/income`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ monthlyIncome: 4500 });
    expect(res.status).toBe(200);
    const aliceMember = res.body.data.household.members.find(
      (m: { userId?: string }) => m.userId === alice._id.toString()
    );
    expect(aliceMember).toBeDefined();
    expect(aliceMember.monthlyIncome).toBe(4500);
  });

  it('returns 403 when caller is not a household member', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/members/me/income`)
      .set('Authorization', auth(carol._id.toString(), carol.email))
      .send({ monthlyIncome: 3000 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/households/:id/savings-budget', () => {
  it('returns 200 and persists the budget for any member (non-owner bob)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/savings-budget`)
      .set('Authorization', auth(bob._id.toString(), bob.email))
      .send({ monthlySavingsBudget: 720 });
    expect(res.status).toBe(200);
    expect(res.body.data.household.settings.monthlySavingsBudget).toBe(720);
  });

  it('returns 400 for a negative budget', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/savings-budget`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ monthlySavingsBudget: -10 });
    expect(res.status).toBe(400);
  });

  it('returns 403 when caller is not a household member', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/savings-budget`)
      .set('Authorization', auth(carol._id.toString(), carol.email))
      .send({ monthlySavingsBudget: 300 });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/households/:id/settlements', () => {
  it('admin can record settlement (201)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/settlements`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ month: '2026-04', amount: 200 });
    expect(res.status).toBe(201);
  });

  it('returns 403 when caller is not admin/owner', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/settlements`)
      .set('Authorization', auth(bob._id.toString(), bob.email))
      .send({ month: '2026-05', amount: 150 });
    expect(res.status).toBe(403);
  });

  it('returns 400 on duplicate-month settlement', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const month = '2026-06';
    const first = await request(app)
      .post(`/api/households/${couple._id}/settlements`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ month, amount: 100 });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post(`/api/households/${couple._id}/settlements`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ month, amount: 100 });
    expect(dup.status).toBe(400);
  });
});

describe('PATCH /api/households/:id/invite-code', () => {
  it('admin can regenerate invite code (200)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/invite-code`)
      .set('Authorization', auth(alice._id.toString(), alice.email));
    expect(res.status).toBe(200);
    expect(res.body.data.household.inviteCode).not.toBe(couple.inviteCode);
    expect(res.body.data.household.inviteCode).toMatch(UUID_V4_REGEX);
  });

  it('returns 403 when non-admin regenerates invite code', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/invite-code`)
      .set('Authorization', auth(bob._id.toString(), bob.email));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/households/:id/invite/email', () => {
  beforeEach(() => vi.mocked(emailMod.sendHouseholdInvitationEmail).mockClear());

  it('admin sends an email invitation', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    const res = await request(app)
      .post(`/api/households/${couple._id}/invite/email`)
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({
        recipientEmail: 'guest@example.com',
        personalNote: 'Come join us!',
      });

    expect(res.status).toBe(202);
    expect(emailMod.sendHouseholdInvitationEmail).toHaveBeenCalledOnce();
    expect(emailMod.sendHouseholdInvitationEmail).toHaveBeenCalledWith(
      'guest@example.com',
      alice.firstName,
      'Alice & Bob',
      expect.any(String),
      expect.any(Date),
      'Come join us!'
    );
  });

  it('non-admin cannot send an email invitation', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');

    const res = await request(app)
      .post(`/api/households/${couple._id}/invite/email`)
      .set('Authorization', auth(bob._id.toString(), bob.email))
      .send({ recipientEmail: 'guest@example.com' });

    expect(res.status).toBe(403);
    expect(emailMod.sendHouseholdInvitationEmail).not.toHaveBeenCalled();
  });
});
