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
    // F5.1: assert created item body shape.
    expect(res.body.data.item).toBeDefined();
    expect(res.body.data.item._id).toBeDefined();
    expect(res.body.data.item.name).toBe('Cheese');
    expect(res.body.data.item.category).toBe('groceries');
    expect(res.body.data.item.isBought).toBe(false);
  });

  it('GET → 200 with filters', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list?boughtState=unbought&limit=20`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F5.2: assert items array and that filter (boughtState=unbought) is applied.
    expect(Array.isArray(res.body.data.items)).toBe(true);
    for (const item of res.body.data.items) {
      expect(item.isBought).toBe(false);
    }
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
    // F5.3: assert updated quantity persisted on response.
    expect(res.body.data.item.quantity).toBe('5 L');
  });

  it('PATCH /:itemId/bought → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('milk');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/${id}/bought`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F5.4: assert toggle effect — isBought + audit fields populated.
    expect(res.body.data.item.isBought).toBe(true);
    expect(res.body.data.item.boughtAt).toBeDefined();
    expect(res.body.data.item.boughtByMemberId).toBeDefined();
  });

  it('POST /:itemId/archive → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('apples');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/${id}/archive`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F5.5: assert archive effect — archivedAt is an ISO 8601 string.
    expect(typeof res.body.data.item.archivedAt).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.data.item.archivedAt))).toBe(false);
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
    // F5.6: assert restore effect — archivedAt cleared, isBought reset to false.
    // Service uses `item.archivedAt = undefined` + `formatResponse` only spreads
    // archivedAt when truthy, so the key is absent (undefined) on the response.
    expect(res.body.data.item.archivedAt).toBeUndefined();
    expect(res.body.data.item.isBought).toBe(false);
  });

  it('DELETE /:itemId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.shopping('shampoo');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/shopping-list/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
    // F5.7: verify deletion by GETting the list and asserting absence.
    const list = await request(app)
      .get(`/api/households/${couple._id}/shopping-list?limit=50`)
      .set('Authorization', auth(alice._id.toString()));
    expect(list.status).toBe(200);
    const idStr = id.toString();
    const found = (list.body.data.items as Array<{ _id: string }>).find(
      (i) => i._id === idStr
    );
    expect(found).toBeUndefined();
  });

  it('GET /history → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/history`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F5.8: assert entries array shape — manual archives have archivedAt + items.
    expect(Array.isArray(res.body.data.entries)).toBe(true);
    for (const entry of res.body.data.entries) {
      expect(typeof entry.archivedAt).toBe('string');
      expect(Array.isArray(entry.items)).toBe(true);
    }
  });

  // F5.9: authz gap — non-member of the target household must be rejected.
  // Carol owns the flatshare household and is not a member of `couple`.
  it('rejects non-member with 403', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ name: 'Intruder cheese', category: 'groceries' });
    expect(res.status).toBe(403);
  });
});
