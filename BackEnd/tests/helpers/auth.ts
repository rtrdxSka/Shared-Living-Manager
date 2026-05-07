import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Types } from 'mongoose';
import request, { type Test } from 'supertest';
import type { Application } from 'express';

/**
 * The production auth middleware (BackEnd/src/middleware/auth.ts) verifies
 * tokens against `process.env.JWT_ACCESS_SECRET` and reads `userId` and
 * `email` off the decoded payload (see IJwtPayload in src/types/user.types.ts).
 * This helper must match both, otherwise authed requests will 401.
 */
const TEST_JWT_SECRET = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set in test env');
  return secret;
};

export const signTestJwt = (
  userId: Types.ObjectId | string,
  email: string = 'test@example.com',
  expiresIn: SignOptions['expiresIn'] = '1h'
): string => {
  return jwt.sign(
    { userId: userId.toString(), email },
    TEST_JWT_SECRET(),
    { expiresIn, algorithm: 'HS256' }
  );
};

/**
 * Returns a thin wrapper that attaches the Authorization header to every request.
 * Usage:
 *   const agent = authedAgent(app, FIXTURES.user('alice')._id, FIXTURES.user('alice').email);
 *   await agent.get('/api/households/...').expect(200);
 */
export const authedAgent = (
  app: Application,
  userId: Types.ObjectId | string,
  email: string = 'test@example.com'
) => {
  const token = signTestJwt(userId, email);
  const wrap = (req: Test): Test => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => wrap(request(app).get(url)),
    post: (url: string) => wrap(request(app).post(url)),
    patch: (url: string) => wrap(request(app).patch(url)),
    put: (url: string) => wrap(request(app).put(url)),
    delete: (url: string) => wrap(request(app).delete(url)),
  };
};
