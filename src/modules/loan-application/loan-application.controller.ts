import { Request, Response, NextFunction } from 'express';
import { LoanApplicationService } from './loan-application.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';

export class LoanApplicationController {
  private service: LoanApplicationService;

  constructor() {
    this.service = new LoanApplicationService();
  }

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const application = await this.service.createApplication(req.user!.id, req.body);

      res.status(201).json({
        success: true,
        data: application,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const application = await this.service.getApplication(req.params.id);

      res.status(200).json({
        success: true,
        data: application,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, sort, fields, ...filters } = req.query;

      const result = await this.service.getAllApplications({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        fields: fields as string,
        filters,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          ...result.meta,
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getUserApplications = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { page, limit, sort, fields, ...filters } = req.query;

      const result = await this.service.getUserApplications(req.user!.id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        fields: fields as string,
        filters,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          ...result.meta,
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const application = await this.service.updateApplication(
        req.params.id,
        req.user!.id,
        req.body,
      );

      res.status(200).json({
        success: true,
        data: application,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public submit = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const application = await this.service.submitApplication(req.params.id, req.user!.id);

      res.status(200).json({
        success: true,
        data: application,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public review = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const application = await this.service.reviewApplication(
        req.params.id,
        req.user!.id,
        req.body,
      );

      res.status(200).json({
        success: true,
        data: application,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.deleteApplication(req.params.id, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
