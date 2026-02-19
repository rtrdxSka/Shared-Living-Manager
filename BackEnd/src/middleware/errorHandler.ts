import { Request, Response, NextFunction } from 'express';
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
  // Default to 500 if not an AppError
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  const response: ErrorResponse = {
    status: 'error',
    message: err instanceof AppError ? err.message : 'Internal server error',
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Log unexpected errors
  if (!(err instanceof AppError) || !err.isOperational) {
    console.error('❌ Unexpected error:', err);
  }

  res.status(statusCode).json(response);
};