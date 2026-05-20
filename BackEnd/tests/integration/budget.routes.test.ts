import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { Budget } from '../../src/models/budget.model';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

describe('Budget routes', () => {
  it('GET /budget → 200 returns current budget (lazy-creates if missing)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    await Budget.deleteOne({ householdId: couple._id });
    const res = await request(app)
      .get(`/api/households/${couple._id}/budget`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.budget.householdId).toBeDefined();
    expect(res.body.data.budget.categories).toBeDefined();
  });

  it('PUT /budget → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .put(`/api/households/${couple._id}/budget`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ categories: { groceries: 300, subscriptions: 50 } });
    expect(res.status).toBe(200);
    expect(res.body.data.budget.categories.groceries).toBe(300);
  });

  it('PUT /budget → 403 (non-admin member)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .put(`/api/households/${couple._id}/budget`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ categories: { groceries: 100 } });
    expect(res.status).toBe(403);
  });

  it('PUT /budget → 400 on unknown category key', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .put(`/api/households/${couple._id}/budget`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ categories: { bogus: 100 } });
    expect(res.status).toBe(400);
  });

  it('PUT /budget → 400 on negative amount', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .put(`/api/households/${couple._id}/budget`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ categories: { groceries: -1 } });
    expect(res.status).toBe(400);
  });

  it('GET /budget/snapshot → 400 on missing month param', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/budget/snapshot`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(400);
  });

  it('GET /budget/snapshot → 400 on malformed month param', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/budget/snapshot?month=2024-1`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(400);
  });

  it('GET /budget/insights → 200 returns composite payload', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/budget/insights?month=${currentMonth()}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.month).toBe(currentMonth());
    expect(data.budget).toBeDefined();
    expect(data.spendByCategory).toBeDefined();
    expect(typeof data.totalSpent).toBe('number');
    expect(typeof data.totalBudgeted).toBe('number');
    expect(Array.isArray(data.monthlyTrend)).toBe(true);
    expect(data.monthlyTrend).toHaveLength(6);
    expect(Array.isArray(data.overBudgetCategories)).toBe(true);
  });

  it('GET /budget → 401 without auth', async () => {
    const couple = FIXTURES.household('couple');
    const res = await request(app).get(`/api/households/${couple._id}/budget`);
    expect(res.status).toBe(401);
  });
});
