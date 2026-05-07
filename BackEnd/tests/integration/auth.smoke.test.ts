import { describe, it, expect, vi } from 'vitest';
import app from '../../src/index';
import request from 'supertest';
import * as emailMod from '../../src/utils/email';
import { User } from '../../src/models/user.model';
import { FIXTURES } from '../seed/fixtures';

describe('POST /api/auth/register (smoke)', () => {
  it('returns 201 and creates a user with a hashed password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

    expect(res.status).toBe(201);

    const created = await User.findOne({ email: 'newuser@example.com' }).select('+password').lean();
    expect(created).not.toBeNull();
    expect(created!.password).not.toBe('Password123!'); // bcrypt-hashed
    expect(created!.password.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate email with 409', async () => {
    const alice = FIXTURES.user('alice');
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: alice.email,
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Imposter',
      });

    expect(res.status).toBe(409);
  });

  it('calls sendVerificationEmail with the new user info', async () => {
    const sendMock = vi.mocked(emailMod.sendVerificationEmail);
    sendMock.mockClear();

    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'verify-me@example.com',
        password: 'Password123!',
        firstName: 'Verify',
        lastName: 'Me',
      })
      .expect(201);

    expect(sendMock).toHaveBeenCalledOnce();
    const [to, firstName] = sendMock.mock.calls[0];
    expect(to).toBe('verify-me@example.com');
    expect(firstName).toBe('Verify');
  });
});
