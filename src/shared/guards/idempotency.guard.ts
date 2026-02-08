import { Request, Response, NextFunction } from 'express';
import { RedisConnection } from '../../infrastructure/cache/redis-connection';
// import { ConflictError } from '../errors/app-error';
// import { v4 as uuidv4 } from 'uuid';

export const idempotencyGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      next();
      return;
    }

    const redis = RedisConnection.getInstance();
    const cacheKey = `idempotency:${idempotencyKey}`;

    const existingResult = await redis.get(cacheKey);

    if (existingResult) {
      const parsedResult = JSON.parse(existingResult);
      res.status(parsedResult.statusCode).json(parsedResult.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const statusCode = res.statusCode;

      redis
        .set(cacheKey, JSON.stringify({ statusCode, body }), 86400)
        .catch((err) => console.error('Failed to cache idempotency result:', err));

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};
