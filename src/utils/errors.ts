// Domain errors shared by the REST and gRPC layers.
// Each transport maps these to its own status codes (HTTP status / gRPC status).

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export type ErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_STATE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

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
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

/** Thrown when a job lifecycle transition is not allowed (e.g. publishing a closed job). */
export class InvalidStateError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_STATE');
  }
}
