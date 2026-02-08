import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { Logger } from '../../infrastructure/logging/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export const errorHandler = (err: Error, req: Request, res: Response, _: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  if (err instanceof AppError) {
    logger.error(`Application Error: ${err.code}`, {
      requestId,
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details || null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    logger.error('JSON Parse Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON format in request body',
        details: process.env.NODE_ENV === 'development' ? err.message : null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'SyntaxError') {
    logger.error('Syntax Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST_FORMAT',
        message: 'Invalid request format',
        details: process.env.NODE_ENV === 'development' ? err.message : null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'ValidationError' && !err.hasOwnProperty('statusCode')) {
    logger.error('Class Validator Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.message,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'ZodError') {
    logger.error('Zod Validation Error', {
      requestId,
      error: err,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (err as any).errors || err.message,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    logger.error('JWT Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    logger.error('Token Expired', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    logger.error('Database Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'CastError') {
    logger.error('Cast Error', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'MongooseValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => e.message);

    logger.error('Mongoose Validation Error', {
      requestId,
      errors,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (err.name === 'PayloadTooLargeError' || (err as any).type === 'entity.too.large') {
    logger.error('Payload Too Large', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
    });

    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unhandled Error', {
    requestId,
    name: err.name,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : null,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
};
