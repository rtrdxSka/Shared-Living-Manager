import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { expenseService } from '../../src/services/expense.service';
import { Household } from '../../src/models/household.model';
import { Expense } from '../../src/models/expense.model';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Expense routes', () => {
  it('POST → 201 creates an expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Coffee', amount: 5, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.data.expense.amount).toBe(5);
  });

  it('POST → 400 on invalid amount', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'X', amount: -1, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it('POST → 403 for non-member', async () => {
    const carol = FIXTURES.user('carol'); // carol is in the flatshare household, not couple
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ description: 'X', amount: 5, category: 'groceries', date: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  it('GET → 200 returns paginated list', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/expenses?limit=10`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // Controller returns `data.items`, not `data.expenses` (see expense.controller.ts listExpenses).
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET → 200 filters by status=unresolved', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/expenses?status=unresolved&limit=50`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
  });

  it('PATCH → 200 updates a non-resolved expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // `rent-may` is unresolved AND created by alice, so the createdBy check passes.
    // (`groceries-week1` is created by bob, which would 403 for alice.)
    const id = FIXTURES.expense('rent-may');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PATCH → 403 when non-creator patches an expense', async () => {
    // `groceries-week1` is created by bob — alice (non-creator) should be rejected
    // by expense.service.ts updateExpense's createdByUserId check.
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Should not apply' });
    expect(res.status).toBe(403);
  });

  it('PATCH → 400 updating settled expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('rent-april'); // isResolved=true
    const res = await request(app)
      .patch(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'X' });
    expect(res.status).toBe(400);
  });

  it('DELETE → 204 deletes own pending expense', async () => {
    // expense.controller.ts deleteExpense returns 204 No Content.
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.expense('groceries-week1'); // bob is payer + creator, unresolved
    const res = await request(app)
      .delete(`/api/households/${couple._id}/expenses/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(204);
  });

  it('POST /:expenseId/claim → 200 claims unclaimed expense', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // Create an unclaimed expense via the API (no paidByUserId provided)
    const created = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ description: 'Anonymous', amount: 10, category: 'groceries', date: new Date().toISOString() });
    expect(created.status).toBe(201);

    const bob = FIXTURES.user('bob');
    // Response uses `_id` (see formatExpenseResponse), not `id`.
    const newId = created.body.data.expense._id;
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${newId}/claim`)
      .set('Authorization', auth(bob._id.toString()));
    // claimExpense allows any financial member to claim an unclaimed expense.
    // bob is a financial member of `couple`, so the call should succeed (200).
    expect(res.status).toBe(200);
    expect(res.body.data.expense.paidByUserId).toBe(bob._id.toString());
  });

  it('POST /:expenseId/request-resolution → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // `dinner-out`: paidBy bob, not pending, not resolved → alice (counterparty) can request.
    // (Note: the plan used `utilities-april`, but that fixture already has pendingConfirmation=true,
    // which causes request-resolution to throw "already pending".)
    const id = FIXTURES.expense('dinner-out');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/request-resolution`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.expense.pendingConfirmation).toBe(true);
  });

  it('POST /:expenseId/confirm-resolution → 200 marks resolved', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    // `utilities-april` is seeded with paidBy=alice and pendingConfirmation=true (requested by bob).
    // Alice is the payer → she confirms receipt → expense becomes resolved.
    const id = FIXTURES.expense('utilities-april');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/confirm-resolution`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.expense.isResolved).toBe(true);
  });

  it('POST /:expenseId/dispute-resolution → 200 cancels pending', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    // `dinner-out` was set to pendingConfirmation in the previous request-resolution test
    // (alice requested resolution on bob's expense). bob (the payer) now disputes → pending cleared.
    const id = FIXTURES.expense('dinner-out');
    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${id}/dispute-resolution`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.expense.pendingConfirmation).toBe(false);
  });

  it('POST /:expenseId/claim → first call wins under concurrency, second returns 400', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');

    // Couple household is seeded with financeMode: 'joint'; force split mode so the
    // claim flow is permitted. (After the parallel claimExpense fix lands, joint
    // households reject /claim entirely — see the joint-mode case below.)
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'split' } },
    );

    // Seed a fresh unclaimed expense via the service (service-first arrange).
    const created = await expenseService.addExpense(
      couple._id.toString(),
      alice._id.toString(),
      {
        description: 'Race-test expense',
        amount: 50,
        category: 'groceries',
        date: new Date().toISOString(),
      },
    );

    // Fire two parallel claims from different financial members.
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/households/${couple._id}/expenses/${created._id}/claim`)
        .set('Authorization', auth(alice._id.toString())),
      request(app)
        .post(`/api/households/${couple._id}/expenses/${created._id}/claim`)
        .set('Authorization', auth(bob._id.toString())),
    ]);

    const successes = [resA, resB].filter((r) => r.status === 200);
    const failures = [resA, resB].filter((r) => r.status === 400);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.body.message).toMatch(/already.*claimed/i);

    // Restore split mode (idempotent — file teardown handled at process exit).
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'split' } },
    );
  });

  it('POST in joint-mode household → creates expense with isResolved: true', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    // Flip the household to joint mode. settings.financeMode is not exposed via
    // expenseService, so a direct Model.updateOne is the minimum-surface arrange.
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'joint' } },
    );

    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses`)
      .set('Authorization', auth(alice._id.toString()))
      .send({
        description: 'Joint-mode expense',
        amount: 25,
        category: 'groceries',
        date: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.expense.isResolved).toBe(true);
    expect(res.body.data.expense.resolvedAt).toBeDefined();

    // Restore split mode so subsequent cases in this file aren't affected.
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'split' } },
    );
  });

  it('POST /:expenseId/claim → 400 in joint mode', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');

    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'joint' } },
    );

    // Create an unclaimed expense directly via the Model so we can override the
    // auto-resolve flag and exercise the /claim rejection path even when the
    // service auto-resolves on create. settings.financeMode + isResolved aren't
    // both reachable via a single service call in joint mode.
    const created = await Expense.create({
      householdId: couple._id,
      createdByUserId: alice._id,
      description: 'Joint-mode claim attempt',
      amount: 10,
      category: 'groceries',
      date: new Date(),
      isFullRepayment: false,
      isResolved: false,
    });

    const res = await request(app)
      .post(`/api/households/${couple._id}/expenses/${created._id}/claim`)
      .set('Authorization', auth(alice._id.toString()));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/joint accounts/i);

    // Restore split mode so subsequent cases in this file aren't affected.
    await Household.updateOne(
      { _id: couple._id },
      { $set: { 'settings.financeMode': 'split' } },
    );
  });
});
