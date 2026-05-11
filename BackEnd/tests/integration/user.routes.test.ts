import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (userId: string, email?: string) =>
  `Bearer ${signTestJwt(userId, email)}`;

describe('PATCH /api/users/profile', () => {
  it('updates first/last name (200)', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ firstName: 'Alicia' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe('Alicia');
  });

  it('returns 403 for unverified users', async () => {
    const dave = FIXTURES.user('dave'); // unverified in seed
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', auth(dave._id.toString(), dave.email))
      // Note: plan used firstName 'D', but the validator requires min length 2.
      // emailVerifiedMiddleware runs BEFORE the validator so dave is rejected
      // at 403, but using a valid value keeps the test intent crystal clear.
      .send({ firstName: 'Da' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/users/profile').send({ firstName: 'Xy' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/password', () => {
  it('returns 200 when current password is correct', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', auth(alice._id.toString(), alice.email))
      .send({ currentPassword: alice.password, newPassword: 'NewPassword1!' });
    expect(res.status).toBe(200);
  });

  it('returns 400 on weak new password', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', auth(alice._id.toString(), alice.email))
      // currentPassword may be stale by this point (the prior test rotated
      // alice's password), but the validator runs BEFORE the controller so
      // a weak newPassword still trips the 400 regardless of currentPassword.
      .send({ currentPassword: 'whatever-the-current-is', newPassword: 'weak' });
    expect(res.status).toBe(400);
  });
});
