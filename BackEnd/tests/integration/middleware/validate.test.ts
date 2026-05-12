import { describe, it, expect } from 'vitest';
import express from 'express';
import { body } from 'express-validator';
import request from 'supertest';
import { handleValidationErrors } from '../../../src/middleware/validate';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/test',
    body('email').isEmail().withMessage('Email must be valid'),
    body('age').isInt({ min: 0 }).withMessage('Age must be a positive integer'),
    handleValidationErrors,
    (_req, res) => {
      res.status(200).json({ ok: true });
    }
  );
  return app;
};

describe('handleValidationErrors middleware', () => {
  it('calls next() when all validators pass', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'a@b.co', age: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 400 with field/message for one bad field', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'not-an-email', age: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      message: 'Validation failed',
    });
    expect(res.body.errors).toEqual([
      { field: 'email', message: 'Email must be valid' },
    ]);
  });

  it('lists all failed fields when multiple validators fail', async () => {
    const res = await request(buildApp())
      .post('/test')
      .send({ email: 'x', age: -1 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(2);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['age', 'email']);
  });
});
