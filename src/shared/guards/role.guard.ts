import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, authGuard } from './auth.guard';
import { ForbiddenError } from '../errors/app-error';
import { UserRole } from '../../modules/user/user.model';

export const roleGuard = (...allowedRoles: UserRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authGuard(req, res, (error?: any) => {
        if (error) {
          return next(error);
        }

        if (!req.user) {
          throw new ForbiddenError('User not authenticated');
        }

        if (!allowedRoles.includes(req.user.role as UserRole)) {
          throw new ForbiddenError('Insufficient role permissions');
        }

        next();
      });
    } catch (error) {
      next(error);
    }
  };
};
