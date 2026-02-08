import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/app-error';

export const notFoundHandler = (req: Request, __: Response, _: NextFunction): void => {
  throw new NotFoundError(`Route ${req.method} ${req.path}`);
};
