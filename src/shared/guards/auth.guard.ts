import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/app-error';
import { UserRepository } from '../../modules/user/user.repository';
import { Types } from 'mongoose';
import { UserRole } from '@/modules/user/user.model';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: Types.ObjectId;
    email: string;
    role: UserRole;
    permissions: string[];
  };
}

export const authGuard = async (
  req: AuthenticatedRequest,
  _: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      role: UserRole;
      permissions: string[];
    };

    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is inactive');
    }

    req.user = {
      id: user.id as Types.ObjectId,
      email: user.email,
      role: user.role as UserRole,
      permissions: user.permissions,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};
