import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/error';
import { logger } from '../utils/logger';


interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: string[];
  stack?: string;
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle known operational errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      status: 'error',
      message: err.message,
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle MongoDB duplicate key errors (e.g. unique index race condition)
  if (
    err instanceof Error &&
    'code' in err &&
    (err as Record<string, unknown>).code === 11000
  ) {
    const response: ErrorResponse = {
      status: 'error',
      message: 'A resource with that value already exists',
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    res.status(409).json(response);
    return;
  }

  // Handle Mongoose validation errors (e.g. schema-level match/required)
  // Return every field's message so the client can surface all issues at once.
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => e.message);
    const response: ErrorResponse = {
      status: 'error',
      message: 'Validation failed',
      errors,
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    res.status(400).json(response);
    return;
  }

  // Handle Mongoose CastError (e.g. malformed ObjectId in a route param
  // reaching findById without an upstream validator). Reply 400 so clients
  // get a clear "bad input" signal instead of an opaque 500.
  if (err instanceof mongoose.Error.CastError) {
    const response: ErrorResponse = {
      status: 'error',
      message: `Invalid ${err.path}`,
    };
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }
    res.status(400).json(response);
    return;
  }

  // Unexpected errors — log and return generic 500
  logger.error({ err }, 'Unexpected error');

  const response: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};