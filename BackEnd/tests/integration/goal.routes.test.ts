import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
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
  });

  it('GET /:goalId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.goal('vacation');
    const res = await request(app)
      .get(`/api/households/${couple._id}/goals/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
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
  });
});
