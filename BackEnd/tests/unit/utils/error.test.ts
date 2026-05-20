import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../../src/utils/error';

describe('AppError taxonomy', () => {
  it('AppError carries message + statusCode + isOperational=true by default', () => {
    const err = new AppError('boom', 418);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(true);
  });

  it('AppError honours an explicit isOperational=false flag', () => {
    const err = new AppError('non-operational', 500, false);
    expect(err.isOperational).toBe(false);
  });

  it.each([
    ['BadRequestError', BadRequestError, 400, 'Bad request'],
    ['UnauthorizedError', UnauthorizedError, 401, 'Unauthorized'],
    ['ForbiddenError', ForbiddenError, 403, 'Forbidden'],
    ['NotFoundError', NotFoundError, 404, 'Resource not found'],
    ['ConflictError', ConflictError, 409, 'Resource already exists'],
  ])('%s factory returns an AppError with statusCode %i and a default message', (_name, factory, expectedStatus, defaultMsg) => {
    const err = (factory as (msg?: string) => AppError)();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(expectedStatus);
    expect(err.isOperational).toBe(true);
    expect(err.message).toBe(defaultMsg);
  });

  it.each([
    [BadRequestError, 400],
    [UnauthorizedError, 401],
    [ForbiddenError, 403],
    [NotFoundError, 404],
    [ConflictError, 409],
  ])('factory at statusCode %i preserves a custom message when provided', (factory, expectedStatus) => {
    const err = (factory as (msg?: string) => AppError)('custom message');
    expect(err.statusCode).toBe(expectedStatus);
    expect(err.message).toBe('custom message');
  });

  it('preserves a stack trace on factory-produced errors', () => {
    const err = NotFoundError('missing');
    expect(typeof err.stack).toBe('string');
    // Stack frames vary by runtime, but the message itself should appear in the stack header.
    expect(err.stack).toContain('missing');
  });
});
