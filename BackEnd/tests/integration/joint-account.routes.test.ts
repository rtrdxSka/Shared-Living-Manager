import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Joint account routes', () => {
  it('GET → 200 for financial member', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/joint-account`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /transactions → 201 deposit', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/joint-account/transactions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ type: 'deposit', amount: 100 });
    expect(res.status).toBe(201);
  });

  it('POST /transactions → 400 on insufficient balance withdrawal', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/joint-account/transactions`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ type: 'withdrawal', amount: 99_999 });
    expect(res.status).toBe(400);
  });

  it('DELETE /transactions/:txId → 403 for non-creator non-admin', async () => {
    // `tx-1` is created by alice; bob is a couple member (role=member, not admin).
    // joint-account.service.ts deleteTransaction allows only the creator or
    // admin/owner — so bob must be rejected. Run before the 204 case below
    // so tx-1 still exists.
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.jointTx('tx-1');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/joint-account/transactions/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(403);
  });

  it('DELETE /transactions/:txId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.jointTx('tx-1');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/joint-account/transactions/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('PATCH /config → 200 admin', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/joint-account/config`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ monthlyTarget: 1000, targetMode: 'equal' });
    expect(res.status).toBe(200);
  });

  it('PATCH /config → 403 non-admin', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/joint-account/config`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ monthlyTarget: 999 });
    expect(res.status).toBe(403);
  });
});
