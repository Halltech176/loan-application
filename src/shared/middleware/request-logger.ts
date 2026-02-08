import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../infrastructure/logging/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};
