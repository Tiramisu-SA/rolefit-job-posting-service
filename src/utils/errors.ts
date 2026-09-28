// Domain errors shared by the transport layers.
// Each transport maps these to its own status codes (gRPC status / HTTP status).

export type ErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_STATE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export interface FieldError {
  /** Path of the invalid field, e.g. `requirements.requiredSkills[1].name`. */
  field: string;
  message: string;
}

export class NotImplementedError extends AppError {
  constructor(operation: string) {
    super(`${operation} is not implemented yet`, 'NOT_IMPLEMENTED');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(
    public readonly details: FieldError[],
    message = details.map((d) => `${d.field}: ${d.message}`).join('; ') || 'Some fields are invalid',
  ) {
    super(message, 'VALIDATION_ERROR');
  }
}

/** Thrown when a job lifecycle transition is not allowed (e.g. publishing a closed job). */
export class InvalidStateError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_STATE');
  }
}

/** No caller identity on a write. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in as a recruiter to do this') {
    super(message, 'UNAUTHORIZED');
  }
}

/** The caller's company does not own the job. */
export class ForbiddenError extends AppError {
  constructor(message = 'This job belongs to another company') {
    super(message, 'FORBIDDEN');
  }
}
