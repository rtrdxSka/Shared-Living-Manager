import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

describe('Task routes', () => {
  it('POST → 201', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ title: 'Take out trash' });
    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe('Take out trash');
  });

  it('POST → 400 on missing title', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .post(`/api/households/${couple._id}/tasks`)
      .set('Authorization', auth(alice._id.toString()))
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET → 200', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const res = await request(app)
      .get(`/api/households/${couple._id}/tasks?limit=10`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(200);
    // task.controller.ts listTasks returns `data: result` where result is { items, nextCursor, rotation? }
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    // F4.1: every returned task carries the documented shape, and the seeded
    // `dishes` task (created by alice in couple) appears in the page.
    for (const task of res.body.data.items) {
      expect(typeof task._id).toBe('string');
      expect(typeof task.title).toBe('string');
      expect(typeof task.createdByUserId).toBe('string');
    }
    const dishesId = FIXTURES.task('dishes').toString();
    expect(res.body.data.items.some((t: { _id: string }) => t._id === dishesId)).toBe(true);
  });

  it('PATCH /rotation → 200 (admin)', async () => {
    const alice = FIXTURES.user('alice'); // owner of `couple`
    const couple = FIXTURES.household('couple');
    const aliceMember = FIXTURES.member('alice-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/rotation`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ startMemberId: aliceMember.toString() });
    expect(res.status).toBe(200);
  });

  it('PATCH /rotation → 403 (non-admin)', async () => {
    const bob = FIXTURES.user('bob'); // role 'member', not admin/owner
    const couple = FIXTURES.household('couple');
    const bobMember = FIXTURES.member('bob-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/rotation`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ startMemberId: bobMember.toString() });
    expect(res.status).toBe(403);
  });

  it('PATCH /:taskId/assign → 200 (admin reassigns)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    const aliceMember = FIXTURES.member('alice-member');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/${id}/assign`)
      .set('Authorization', auth(alice._id.toString()))
      .send({ assignedToMemberId: aliceMember.toString() });
    expect(res.status).toBe(200);
    expect(res.body.data.task.assignedToMemberId).toBe(aliceMember.toString());
  });

  it('PATCH /:taskId/complete → 200', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('dishes');
    const res = await request(app)
      .patch(`/api/households/${couple._id}/tasks/${id}/complete`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.task.isCompleted).toBe(true);
    // F4.2: task.service.ts toggleComplete populates completedAt and
    // completedByMemberId (lines 183-190). Verify both appear on the response.
    expect(res.body.data.task.completedAt).toBeDefined();
    expect(res.body.data.task.completedByMemberId).toBeDefined();
    expect(res.body.data.task.completedByMemberId).toBe(
      FIXTURES.member('bob-member').toString()
    );
  });

  it('DELETE → 204 (creator)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const id = FIXTURES.task('vacuum'); // created by alice
    const res = await request(app)
      .delete(`/api/households/${couple._id}/tasks/${id}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  it('DELETE → 403 (non-creator non-admin)', async () => {
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');
    // Use `trash` (created by alice, bob is member-role, not admin). `vacuum` was
    // deleted by the previous test.
    const id = FIXTURES.task('trash');
    const res = await request(app)
      .delete(`/api/households/${couple._id}/tasks/${id}`)
      .set('Authorization', auth(bob._id.toString()));
    expect(res.status).toBe(403);
  });

  // F4.3: task.service.ts deleteTask (lines 223-228) allows admin/owner to
  // delete tasks they did not create. Cover the admin-deletes-other path.
  it('admin can delete a task they did not create', async () => {
    const alice = FIXTURES.user('alice'); // owner of couple
    const bob = FIXTURES.user('bob');
    const couple = FIXTURES.household('couple');

    // Bob creates a fresh task so the test is self-contained and doesn't
    // depend on seed ordering (no seeded task is created by bob in couple).
    const created = await request(app)
      .post(`/api/households/${couple._id}/tasks`)
      .set('Authorization', auth(bob._id.toString()))
      .send({ title: 'Bob-created task for admin delete' });
    expect(created.status).toBe(201);
    const taskId = created.body.data.task._id;

    const res = await request(app)
      .delete(`/api/households/${couple._id}/tasks/${taskId}`)
      .set('Authorization', auth(alice._id.toString()));
    expect(res.status).toBe(204);
  });

  // F4.4: task.service.ts addTask (lines 27-29) rejects members whose
  // participatesInTasks is false. Frank in flatshare has that flag set false.
  it('returns 403 when a non-task-participating member creates a task', async () => {
    const frank = FIXTURES.user('frank');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/tasks`)
      .set('Authorization', auth(frank._id.toString()))
      .send({ title: 'Frank attempt' });
    expect(res.status).toBe(403);
  });
});
