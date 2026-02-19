export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Common error factories ────────────────────────────────────────────

export const BadRequestError = (message = 'Bad request') =>
  new AppError(message, 400);

export const UnauthorizedError = (message = 'Unauthorized') =>
  new AppError(message, 401);

export const ForbiddenError = (message = 'Forbidden') =>
  new AppError(message, 403);

export const NotFoundError = (message = 'Resource not found') =>
  new AppError(message, 404);

export const ConflictError = (message = 'Resource already exists') =>
  new AppError(message, 409);