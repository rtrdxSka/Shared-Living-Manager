import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

/**
 * Reality-vs-plan corrections:
 *   - Plan used `category: 'dairy'` / `'pantry'`, but the validator
 *     (recurring-shopping-item.validator.ts EXPENSE_TYPE_VALUES) only accepts
 *     rent|utilities|internet|groceries|cleaning|subscriptions|other.
 *     → use 'groceries'.
 *   - Plan used `created.body.data.rule.id`, but the service formatter
 *     (recurring-shopping-item.service.ts formatResponse) emits `_id`, not `id`.
 *     → read `rule._id`.
 */

describe('Recurring shopping item routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Milk', category: 'groceries', cadence: 'weekly' });
    expect(res.status).toBe(201);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH /:ruleId → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'Old', category: 'groceries', cadence: 'weekly' });
    expect(created.status).toBe(201);
    const ruleId = created.body.data.rule._id;
    const res = await request(app)
      .patch(`/api/households/${couple._id}/shopping-list/recurring/${ruleId}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'New' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:ruleId → 204', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ name: 'X', category: 'groceries', cadence: 'weekly' });
    expect(created.status).toBe(201);
    const ruleId = created.body.data.rule._id;
    const res = await request(app)
      .delete(`/api/households/${couple._id}/shopping-list/recurring/${ruleId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });
});
