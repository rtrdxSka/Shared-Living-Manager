import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import app from '../../src/index';
import { Goal } from '../../src/models/goal.model';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Goal routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'New Goal', targetAmount: 500 });
    expect(res.status).toBe(201);
    // F6.1 — assert created goal body
    expect(res.body.data.goal).toMatchObject({
      name: 'New Goal',
      targetAmount: 500,
      householdId: couple._id.toString(),
    });
    expect(res.body.data.goal._id).toBeTypeOf('string');
  });

  it('POST → 400 on missing target', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('GET → 200 paginated', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F6.2 — assert response shape and seed presence
    expect(Array.isArray(res.body.data.items)).toBe(true);
    const vacationId = FIXTURES.goal('vacation').toString();
    expect(
      res.body.data.items.some((g: { _id: string }) => g._id === vacationId)
    ).toBe(true);
  });

  it('GET /:goalId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F6.3 — assert returned goal matches seed
    expect(res.body.data.goal._id).toBe(id.toString());
    expect(res.body.data.goal.name).toBe('Summer Vacation');
    expect(res.body.data.goal.targetAmount).toBe(2500);
  });

  // F6.4 — 404 path for getGoal
  it('GET /:goalId → 404 for a non-existent goalId', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals/${missingId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(404);
  });

  it('PATCH /:goalId → 200 by creator', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ targetAmount: 3000 });
    expect(res.status).toBe(200);
    // F6.5 — assert update is reflected in response
    expect(res.body.data.goal.targetAmount).toBe(3000);
    expect(res.body.data.goal._id).toBe(id.toString());
  });

  // F6.6 — non-creator non-admin PATCH should 403
  // Bob is `member` role in couple (non-admin non-owner). Vacation is alice's.
  it('PATCH /:goalId → 403 when non-creator non-admin updates a goal', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ name: 'unauthorized rename' });
    expect(res.status).toBe(403);
  });

  // F6.7 — non-creator non-admin DELETE should 403
  it('DELETE /:goalId → 403 when non-creator non-admin deletes a goal', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(403);
  });

  it('DELETE /:goalId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  // F6.8 — DELETE 404 path
  it('DELETE /:goalId → 404 for a non-existent goalId', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app)
      .delete(`/api/households/${couple._id}/goals/${missingId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(404);
  });

  it('POST /:goalId/contributions → 201', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    // Tests share seeded state via beforeAll; the prior DELETE test removes the
    // 'vacation' fixture goal, so create a fresh goal here to exercise contributions.
    const created = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Contribution Target', targetAmount: 200 });
    const goalId = created.body.data.goal.id ?? created.body.data.goal._id;
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals/${goalId}/contributions`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ amount: 50 });
    expect(res.status).toBe(201);
    // F6.9 — assert the new contribution is reflected in the response
    expect(res.body.data.goal.currentAmount).toBe(50);
    expect(Array.isArray(res.body.data.goal.contributions)).toBe(true);
    expect(res.body.data.goal.contributions.length).toBe(1);
    expect(res.body.data.goal.contributions[0].amount).toBe(50);
  });

  // F6.10a — POST contribution 404 for non-existent goal
  it('POST /:goalId/contributions → 404 for a non-existent goalId', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app)
      .post(`/api/households/${couple._id}/goals/${missingId}/contributions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ amount: 25 });
    expect(res.status).toBe(404);
  });

  // F6.10b — POST contribution 400 when goal is not active
  it('POST /:goalId/contributions → 400 when goal is completed (inactive)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // Create a fresh goal then flip its status to 'completed' directly via the model.
    const created = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Completed-only goal', targetAmount: 150 });
    const goalId = created.body.data.goal._id;
    await Goal.updateOne({ _id: goalId }, { $set: { status: 'completed' } });

    const res = await request(app)
      .post(`/api/households/${couple._id}/goals/${goalId}/contributions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ amount: 25 });
    expect(res.status).toBe(400);
  });

  // ── PATCH /:goalId/priority ────────────────────────────────────────

  it('PATCH /:goalId/priority → 200, any member can set it', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob'); // non-owner member
    const couple = FIXTURES.household('couple');

    // Self-contained: the seeded 'vacation' goal is removed by the DELETE test
    // above (shared per-file state), so create a fresh goal here.
    const created = await request(app)
      .post(`/api/households/${couple._id}/goals`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Priority route goal', targetAmount: 500 });
    const goalId = created.body.data.goal._id;
    expect(created.body.data.goal.priority).toBe('normal'); // default

    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${goalId}/priority`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.goal.priority).toBe('high');
  });

  it('PATCH /:goalId/priority → 400 on invalid value', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const vacation = FIXTURES.goal('vacation');

    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${vacation}/priority`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ priority: 'urgent' });

    expect(res.status).toBe(400);
  });

  it('PATCH /:goalId/priority → 403 for a non-member', async () => {
    const carol = FIXTURES.user('carol'); // not in the couple
    const couple = FIXTURES.household('couple');
    const vacation = FIXTURES.goal('vacation');

    const res = await request(app)
      .patch(`/api/households/${couple._id}/goals/${vacation}/priority`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ priority: 'low' });

    expect(res.status).toBe(403);
  });
});
