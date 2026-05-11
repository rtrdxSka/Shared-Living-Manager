import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authMiddleware, emailVerifiedMiddleware } from '../../../src/middleware/auth';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { signTestJwt } from '../../helpers/auth';
import { FIXTURES } from '../../seed/fixtures';

const buildApp = () => {
  const app = express();
  app.get('/gated', authMiddleware, emailVerifiedMiddleware, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
};

describe('emailVerifiedMiddleware', () => {
  it('allows verified users through (200)', async () => {
    const alice = FIXTURES.user('alice'); // isEmailVerified=true in seed
    const token = signTestJwt(alice._id);
    const res = await request(buildApp()).get('/gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects unverified users (403)', async () => {
    const dave = FIXTURES.user('dave'); // isEmailVerified=false in seed
    const token = signTestJwt(dave._id);
    const res = await request(buildApp()).get('/gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
