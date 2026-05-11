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
});
