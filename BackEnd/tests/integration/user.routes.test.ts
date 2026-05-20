import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/user.model';
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
    // F1.6 — Create a fresh, isolated user via the public register endpoint to
    // remove any dependency on stale fixture state (alice's password may have
    // been rotated by a prior test). After verifying the 400 rejection, login
    // with the original strong password to prove no mutation occurred.
    const email = `weakpw-${Date.now()}@example.com`;
    const strongPassword = 'StrongPass1!';

    const reg = await request(app).post('/api/auth/register').send({
      email,
      password: strongPassword,
      firstName: 'Weak',
      lastName: 'Pw',
    });
    expect(reg.status).toBe(201);
    const userId = reg.body.data.user._id as string;
    // Mark verified directly — the password route runs emailVerifiedMiddleware
    // before the validator, so an unverified user would 403 before we reach
    // the weak-password rejection we're exercising.
    await User.updateOne({ email }, { isEmailVerified: true });

    const res = await request(app)
      .patch('/api/users/password')
      .set('Authorization', auth(userId, email))
      .send({ currentPassword: strongPassword, newPassword: 'weak' });
    expect(res.status).toBe(400);

    // Original strong password must still work — the failed weak-password
    // request must not have mutated the user.
    const login = await request(app).post('/api/auth/login').send({
      email,
      password: strongPassword,
    });
    expect(login.status).toBe(200);
  });
});
