import type { NextFunction, Request, Response } from 'express';
import { AppError, type ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const HTTP_STATUS: Record<ErrorCode, number> = {
  NOT_IMPLEMENTED: 501,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_STATE: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(HTTP_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // TODO: Map Mongoose errors (CastError, ValidationError, duplicate key) to proper responses.
  logger.error('Unhandled error', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
