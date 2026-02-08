import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, authGuard } from './auth.guard';
import { ForbiddenError } from '../errors/app-error';

export const permissionGuard = (...requiredPermissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authGuard(req, res, (error?: any) => {
        if (error) {
          return next(error);
        }

        if (!req.user) {
          throw new ForbiddenError('User not authenticated');
        }

        const hasPermission = requiredPermissions.every((permission) =>
          req.user!.permissions.includes(permission),
        );

        if (!hasPermission) {
          throw new ForbiddenError('Insufficient permissions');
        }

        next();
      });
    } catch (error) {
      next(error);
    }
  };
};
