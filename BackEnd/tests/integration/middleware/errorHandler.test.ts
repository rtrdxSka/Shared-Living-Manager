import { describe, it, expect, afterEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { NotFoundError, ForbiddenError } from '../../../src/utils/error';

const buildApp = (err: unknown) => {
  const app = express();
  app.use(express.json());
  app.get('/throw', (_req: Request, _res: Response, next: NextFunction) => {
    next(err as Error);
  });
  app.use(errorHandler);
  return app;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('errorHandler middleware', () => {
  it('handles AppError (404 NotFoundError) and omits stack in non-development env', async () => {
    const res = await request(buildApp(NotFoundError('User not found')))
      .get('/throw');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'User not found' });
    expect(res.body.stack).toBeUndefined();
  });

  it('handles AppError (403 ForbiddenError)', async () => {
    const res = await request(buildApp(ForbiddenError('Not allowed')))
      .get('/throw');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: 'error', message: 'Not allowed' });
  });

  it('handles Mongoose ValidationError with field-level messages', async () => {
    const validationErr = new mongoose.Error.ValidationError();
    validationErr.addError(
      'email',
      new mongoose.Error.ValidatorError({ message: 'Email is required', path: 'email' })
    );
    validationErr.addError(
      'age',
      new mongoose.Error.ValidatorError({ message: 'Age must be a number', path: 'age' })
    );

    const res = await request(buildApp(validationErr)).get('/throw');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Email is required', 'Age must be a number'])
    );
    expect(res.body.errors).toHaveLength(2);
  });

  it('handles MongoDB duplicate-key errors (code 11000) as 409', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    const res = await request(buildApp(dupErr)).get('/throw');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      status: 'error',
      message: 'A resource with that value already exists',
    });
  });

  it('handles Mongoose CastError (e.g. malformed ObjectId) as 400', async () => {
    const castErr = new mongoose.Error.CastError(
      'ObjectId',
      'not-an-object-id',
      'expenseId'
    );

    const res = await request(buildApp(castErr)).get('/throw');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'Invalid expenseId' });
    expect(res.body.stack).toBeUndefined();
  });

  it('includes stack trace for Mongoose CastError in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const castErr = new mongoose.Error.CastError(
      'ObjectId',
      'not-an-object-id',
      'expenseId'
    );

    const res = await request(buildApp(castErr)).get('/throw');

    expect(res.status).toBe(400);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });

  it('falls back to generic 500 for unexpected errors', async () => {
    const res = await request(buildApp(new Error('boom'))).get('/throw');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ status: 'error', message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });

  it('includes stack trace in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await request(buildApp(NotFoundError('dev mode')))
      .get('/throw');

    expect(res.status).toBe(404);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });

  it('includes stack trace for duplicate-key errors in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    const res = await request(buildApp(dupErr)).get('/throw');

    expect(res.status).toBe(409);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });

  it('includes stack trace for Mongoose ValidationError in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const validationErr = new mongoose.Error.ValidationError();
    validationErr.addError(
      'email',
      new mongoose.Error.ValidatorError({ message: 'Email is required', path: 'email' })
    );

    const res = await request(buildApp(validationErr)).get('/throw');

    expect(res.status).toBe(400);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });

  it('includes stack trace for generic Error in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await request(buildApp(new Error('boom'))).get('/throw');

    expect(res.status).toBe(500);
    expect(res.body.stack).toBeDefined();
    expect(typeof res.body.stack).toBe('string');
    expect(res.body.stack.length).toBeGreaterThan(0);
  });
});
