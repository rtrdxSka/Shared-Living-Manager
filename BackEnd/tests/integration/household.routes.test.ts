import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { makeUser } from '../helpers/factories';

const auth = (userId: string, email?: string) =>
  `Bearer ${signTestJwt(userId, email)}`;

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
  });
});
