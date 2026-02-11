import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';

export class AuthController {
  private service: AuthService;

  constructor() {
    this.service = new AuthService();
  }

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body);

      res.status(201).json({
        success: true,
        data: result,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body);

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public requestVerification = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.requestVerification(String(req.user?.id), req.body);

      res.status(200).json({
        success: true,
        data: { message: 'Verification email sent if the email is registered' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.verifyEmail(req.body);

      res.status(200).json({
        success: true,
        data: { message: 'Email verified successfully' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.verifyPhone(req.body.token);

      res.status(200).json({
        success: true,
        data: { message: 'Phone number verified successfully' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.forgotPassword(req.body);

      res.status(200).json({
        success: true,
        data: { message: 'Password reset email sent if the email is registered' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resetPassword(req.body);

      res.status(200).json({
        success: true,
        data: { message: 'Password reset successfully' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await this.service.refreshToken(req.body.refreshToken);

      res.status(200).json({
        success: true,
        data: tokens,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.logout(String(req.user!.id), req.body.refreshToken);

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public logoutAll = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.logoutAll(String(req.user!.id));

      res.status(200).json({
        success: true,
        data: { message: 'Logged out from all devices successfully' },
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
