import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { ShoppingListItem } from '../../src/models/shopping-list-item.model';

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
 *   - The list controller wraps the service's `rules` under `data: { items }`,
 *     so list responses use `res.body.data.items`, not `data.rules`.
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
    // F5.13: assert created rule body shape.
    expect(res.body.data.rule).toBeDefined();
    expect(res.body.data.rule._id).toBeDefined();
    expect(res.body.data.rule.name).toBe('Milk');
    expect(res.body.data.rule.category).toBe('groceries');
    expect(res.body.data.rule.cadence).toBe('weekly');
    expect(res.body.data.rule.active).toBe(true);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // F5.14: assert items array shape. Controller emits `data: { items }`.
    expect(Array.isArray(res.body.data.items)).toBe(true);
    for (const rule of res.body.data.items) {
      expect(typeof rule.name).toBe('string');
      expect(typeof rule.cadence).toBe('string');
      expect(typeof rule.active).toBe('boolean');
    }
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
    // F5.15: assert renamed value reflected in response.
    expect(res.body.data.rule.name).toBe('New');
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
    // F5.16: verify deletion by GETting the list and asserting absence.
    const list = await request(app)
      .get(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(alice._id.toString()));
    expect(list.status).toBe(200);
    const found = (list.body.data.items as Array<{ _id: string }>).find(
      (r) => r._id === ruleId
    );
    expect(found).toBeUndefined();
  });

  // F5.17: authz gap — non-member of the target household must be rejected.
  it('rejects non-member with 403', async () => {
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ name: 'Intruder rule', category: 'groceries', cadence: 'weekly' });
    expect(res.status).toBe(403);
  });

  // C6 / D18: dry-run preview endpoint — match trigger words against current active items.
  it('POST /preview-matches → 200 returns active items matching trigger words', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    // Seed two extra active shopping items: one with a unique substring we'll
    // target ("kombucha"), one that should NOT match.
    // NOTE: schema uses `name` (not `description`) and `archivedAt` (not `isBought`)
    // for "active" — see BackEnd/src/models/shopping-list-item.model.ts.
    // Using "kombucha" avoids colliding with the seeded "Milk" / "Bread" / etc.
    await ShoppingListItem.create([
      {
        householdId: couple._id,
        name: '2 bottles of kombucha',
        category: 'groceries',
        addedByUserId: alice._id,
        isBought: false,
      },
      {
        householdId: couple._id,
        name: 'paper towels',
        category: 'cleaning',
        addedByUserId: alice._id,
        isBought: false,
      },
    ]);

    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring/preview-matches`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ triggerWords: ['kombucha'], category: 'groceries' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.matchedItems)).toBe(true);
    expect(res.body.data.matchedItems).toHaveLength(1);
    expect(res.body.data.matchedItems[0].name).toBe('2 bottles of kombucha');
  });

  it('POST /preview-matches → 403 for non-member', async () => {
    const carol = FIXTURES.user('carol'); // NOT a member of couple
    const couple = FIXTURES.household('couple');

    const res = await request(app)
      .post(`/api/households/${couple._id}/shopping-list/recurring/preview-matches`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ triggerWords: ['milk'] });

    expect(res.status).toBe(403);
  });
});
