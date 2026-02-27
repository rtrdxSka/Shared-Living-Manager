import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/error';


interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: Record<string, string>[];
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

  // Handle Mongoose validation errors (e.g. schema-level match/required)
  if (err instanceof mongoose.Error.ValidationError) {
    const firstError = Object.values(err.errors)[0];
    const response: ErrorResponse = {
      status: 'error',
      message: firstError?.message || 'Validation failed',
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    res.status(400).json(response);
    return;
  }

  // Unexpected errors — log and return generic 500
  console.error('❌ Unexpected error:', err);

  const response: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};