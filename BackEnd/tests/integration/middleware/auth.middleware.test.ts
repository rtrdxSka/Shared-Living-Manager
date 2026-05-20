import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authMiddleware } from '../../../src/middleware/auth';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { signTestJwt } from '../../helpers/auth';
import { FIXTURES } from '../../seed/fixtures';
import jwt from 'jsonwebtoken';

const buildApp = () => {
  const app = express();
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ userId: (req as any).user?.userId });
  });
  app.use(errorHandler);
  return app;
};

describe('authMiddleware', () => {
  it('attaches user payload when JWT is valid', async () => {
    const alice = FIXTURES.user('alice');
    const token = signTestJwt(alice._id);
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(alice._id.toString());
  });

  it('rejects requests without an Authorization header (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects malformed tokens (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with wrong secret (401)', async () => {
    const alice = FIXTURES.user('alice');
    const badToken = jwt.sign({ userId: alice._id.toString() }, 'wrong-secret', { expiresIn: '1h' });
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens (401)', async () => {
    const alice = FIXTURES.user('alice');
    const expired = jwt.sign(
      { userId: alice._id.toString() },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '-1s' }
    );
    const app = buildApp();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});
