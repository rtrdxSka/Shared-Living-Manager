import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Recurring task routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Take out trash', interval: 'weekly' });
    expect(res.status).toBe(201);
    // Controller returns `data.recurringTask`, not `data.task`
    // (see recurring-task.controller.ts create).
    expect(res.body.data.recurringTask.title).toBe('Take out trash');
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('PATCH /:recurringTaskId → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Old', interval: 'weekly' });
    // Service returns `_id` as string, exposed as `data.recurringTask._id`,
    // NOT `data.task.id` as the plan suggested.
    const recurringTaskId = created.body.data.recurringTask._id;
    const res = await request(app)
      .patch(`/api/households/${couple._id}/recurring-tasks/${recurringTaskId}`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.data.recurringTask.title).toBe('New');
  });

  it('DELETE /:recurringTaskId → 204', async () => {
    // recurring-task.controller.ts `deactivate` performs a soft-delete and
    // responds with 204 No Content.
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const created = await request(app)
      .post(`/api/households/${couple._id}/recurring-tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'X', interval: 'weekly' });
    const recurringTaskId = created.body.data.recurringTask._id;
    const res = await request(app)
      .delete(`/api/households/${couple._id}/recurring-tasks/${recurringTaskId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  // F4.8: recurring-task.service.ts create (lines 42-44) rejects members whose
  // participatesInTasks is false. Frank is such a member in flatshare.
  it('returns 403 when a non-task-participating member creates a recurring task', async () => {
    const frank = FIXTURES.user('frank');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/recurring-tasks`)
      .set('Authorization', auth(frank._id.toString()))
      .send({ title: 'Frank attempt', interval: 'weekly' });
    expect(res.status).toBe(403);
  });

  // F4.9: recurring-task.service.ts update (lines 102-105) allows admins to
  // bypass the creator check. Eve (admin in flatshare) patches a template
  // created by carol (owner).
  it('admin can patch a recurring task they did not create', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/recurring-tasks`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Carol-created', interval: 'weekly' });
    expect(created.status).toBe(201);
    const recurringTaskId = created.body.data.recurringTask._id;

    const res = await request(app)
      .patch(`/api/households/${flatshare._id}/recurring-tasks/${recurringTaskId}`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ title: 'Eve-renamed' });
    expect(res.status).toBe(200);
    expect(res.body.data.recurringTask.title).toBe('Eve-renamed');
  });

  // F4.10: recurring-task.service.ts deactivate (lines 148-151) allows admins
  // to bypass the creator check. Eve (admin) deactivates carol's template.
  it('admin can deactivate a recurring task they did not create', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/recurring-tasks`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Carol-created for deactivate', interval: 'weekly' });
    expect(created.status).toBe(201);
    const recurringTaskId = created.body.data.recurringTask._id;

    const res = await request(app)
      .delete(`/api/households/${flatshare._id}/recurring-tasks/${recurringTaskId}`)
      .set('Authorization', auth(eve._id.toString()));
    expect(res.status).toBe(204);
  });
});
