import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

/**
 * Reality-vs-plan corrections:
 *   - Plan used `category: 'dairy'` for POST, but the validator
 *     (shopping-list.validator.ts EXPENSE_TYPE_VALUES) only accepts
 *     rent|utilities|internet|groceries|cleaning|subscriptions|other.
 *     → use 'groceries'.
 *   - Plan used numeric `quantity: 5` for PATCH, but the validator runs
 *     `.trim()` on the value; pass a string instead.
 */

describe('Shopping list routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Cheese', category: 'groceries' });
    expect(res.status).toBe(201);
  });

  it('GET → 200 with filters', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list?boughtState=unbought&limit=20`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:itemId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ quantity: '5 L' });
    expect(res.status).toBe(200);
  });

  it('PATCH /:itemId/bought → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/${id}/bought`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /:itemId/archive → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('apples');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/archive`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('POST /:itemId/restore → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // `apples` was archived by the previous test in this file (seed is per-file,
    // not per-test). Restore directly — the explicit pre-archive request would
    // 400 with "Item is already archived".
    const id = FIXTURES.shopping('apples');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/restore`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('DELETE /:itemId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('shampoo');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/shopping-list/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('GET /history → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/history`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });
});
