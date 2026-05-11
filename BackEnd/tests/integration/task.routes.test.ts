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
});
