import { Request, Response, NextFunction } from 'express';
import { RepaymentService } from './repayment.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';
import { Types } from 'mongoose';

export class RepaymentController {
  private service: RepaymentService;

  constructor() {
    this.service = new RepaymentService();
  }

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const repayment = await this.service.createRepayment(String(req.user!.id), req.body);

      res.status(201).json({
        success: true,
        data: repayment,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public processPayment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const repayment = await this.service.processPayment(req.user!.id, req.body);

      res.status(200).json({
        success: true,
        data: repayment,
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
      const repayment = await this.service.getRepayment(req.params.id);

      res.status(200).json({
        success: true,
        data: repayment,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getLoanRepayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { page, limit, sort, fields, ...filters } = req.query;

      const result = await this.service.getLoanRepayments(req.params.loanId, {
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

  public recordPayment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const repayment = await this.service.recordPayment(
        req.params.id,
        String(req.user!.id),
        req.body,
      );

      res.status(200).json({
        success: true,
        data: repayment,
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
