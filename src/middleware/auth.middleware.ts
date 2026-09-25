import type { NextFunction, Request, Response } from 'express';

/**
 * Placeholder authentication/authorization middleware. Currently lets every request through.
 *
 * TODO: Decide how identity reaches this service (API gateway header? JWT?).
 * TODO: Attach the caller identity to the request and enforce role/ownership checks.
 */
export function authenticate(_req: Request, _res: Response, next: NextFunction) {
  next();
}
