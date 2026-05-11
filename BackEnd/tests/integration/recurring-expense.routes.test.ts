import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Recurring expense routes', () => {
  it('POST → 201 fixed payer', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'Rent', amount: 1200, category: 'rent',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    expect(res.status).toBe(201);
    // Controller returns `data.recurringExpense`, not `data.recurring`
    // (see recurring-expense.controller.ts create).
    expect(res.body.data.recurringExpense.amount).toBe(1200);
  });

  it('POST → 400 fixed mode without payer', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 1, category: 'rent',
        interval: 'monthly', payerMode: 'fixed',
      });
    expect(res.status).toBe(400);
  });

  it('GET → 200 lists active templates', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('PATCH /:recurringId → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 50, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    // Service returns `_id` as a string (see recurring-expense.service.ts), exposed as
    // `data.recurringExpense._id` on the controller response — NOT `.recurring.id`.
    const recurringId = created.body.data.recurringExpense._id;
    const res = await request(app)
      .patch(`/api/households/${couple._id}/recurring-expenses/${recurringId}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ amount: 75 });
    expect(res.status).toBe(200);
    expect(res.body.data.recurringExpense.amount).toBe(75);
  });

  it('POST → 403 when a non-member attempts to create a template', async () => {
    // carol belongs to `flatshare`, not `couple`. recurring-expense.service.ts
    // routes through getHouseholdForMember which throws 403 for non-members.
    const carol = FIXTURES.user('carol');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        description: 'Should not apply', amount: 10, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: carol._id.toString(),
      });
    expect(res.status).toBe(403);
  });

  it('PATCH /:recurringId → 403 for non-creator non-admin financial field', async () => {
    // In flatshare: carol (owner) creates a template; frank (member, not admin)
    // attempts to PATCH the amount (a financial field). recurring-expense.service.ts
    // update enforces creator-or-admin authz before financial field gate.
    const carol = FIXTURES.user('carol');
    const frank = FIXTURES.user('frank');
    const flatshare = FIXTURES.household('flatshare');
    const created = await request(app)
      .post(`/api/households/${flatshare._id}/recurring-expenses`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        description: 'Flat utilities', amount: 60, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: carol._id.toString(),
      });
    expect(created.status).toBe(201);
    const recurringId = created.body.data.recurringExpense._id;

    const res = await request(app)
      .patch(`/api/households/${flatshare._id}/recurring-expenses/${recurringId}`)
      .set('Authorization', auth(frank._id.toString()))
      .send({ amount: 80 });
    expect(res.status).toBe(403);
  });

  it('DELETE /:recurringId → 403 for non-creator non-admin', async () => {
    // In flatshare: carol (owner) creates a template; frank (member, not admin)
    // attempts to deactivate it. recurring-expense.service.ts deactivate enforces
    // creator-or-admin authz.
    const carol = FIXTURES.user('carol');
    const frank = FIXTURES.user('frank');
    const flatshare = FIXTURES.household('flatshare');
    const created = await request(app)
      .post(`/api/households/${flatshare._id}/recurring-expenses`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        description: 'Flat broadband', amount: 30, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: carol._id.toString(),
      });
    expect(created.status).toBe(201);
    const recurringId = created.body.data.recurringExpense._id;

    const res = await request(app)
      .delete(`/api/households/${flatshare._id}/recurring-expenses/${recurringId}`)
      .set('Authorization', auth(frank._id.toString()));
    expect(res.status).toBe(403);
  });

  it('DELETE /:recurringId → 204', async () => {
    // recurring-expense.controller.ts `deactivate` performs a soft-delete and
    // responds with 204 No Content.
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'X', amount: 10, category: 'utilities',
        interval: 'monthly', payerMode: 'fixed', fixedPayerUserId: alice._id.toString(),
      });
    const recurringId = created.body.data.recurringExpense._id;
    const res = await request(app)
      .delete(`/api/households/${couple._id}/recurring-expenses/${recurringId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });
});
