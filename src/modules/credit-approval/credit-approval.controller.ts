import { Request, Response, NextFunction } from 'express';
import { CreditApprovalService } from './credit-approval.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';
import { Types } from 'mongoose';

export class CreditApprovalController {
  private service: CreditApprovalService;

  constructor() {
    this.service = new CreditApprovalService();
  }

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const approval = await this.service.createApproval(req.user!.id, req.body);

      res.status(201).json({
        success: true,
        data: approval,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await this.service.getApproval(req.params.id as unknown as Types.ObjectId);

      res.status(200).json({
        success: true,
        data: approval,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getByLoanId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await this.service.getApprovalByLoanId(
        req.params.loanId as unknown as Types.ObjectId,
      );

      res.status(200).json({
        success: true,
        data: approval,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
