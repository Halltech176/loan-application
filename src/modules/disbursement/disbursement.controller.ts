import { Request, Response, NextFunction } from 'express';
import { DisbursementService } from './disbursement.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';
import { Types } from 'mongoose';

export class DisbursementController {
  private service: DisbursementService;

  constructor() {
    this.service = new DisbursementService();
  }

  public create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const disbursement = await this.service.createDisbursement(req.user!.id, req.body);

      res.status(202).json({
        success: true,
        data: disbursement,
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
      const disbursement = await this.service.getDisbursement(new Types.ObjectId(req.params.id));

      res.status(200).json({
        success: true,
        data: disbursement,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getByLoanId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const disbursement = await this.service.getDisbursementByLoanId(
        new Types.ObjectId(req.params.loanId),
      );

      res.status(200).json({
        success: true,
        data: disbursement,
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
