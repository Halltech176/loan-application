export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: Record<string, string[]>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied', details?: any) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, details?: any) {
    super(404, 'NOT_FOUND', `${resource} not found`, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any, code: string = 'CONFLICT') {
    super(409, code, message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: any, code: string = 'UNPROCESSABLE_ENTITY') {
    super(422, code, message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(429, 'TOO_MANY_REQUESTS', message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}

export class BadGatewayError extends AppError {
  constructor(message: string = 'Bad gateway', details?: any) {
    super(502, 'BAD_GATEWAY', message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable', details?: any) {
    super(503, 'SERVICE_UNAVAILABLE', message, details);
  }
}
