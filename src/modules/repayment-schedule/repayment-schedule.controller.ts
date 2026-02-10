import { Request, Response, NextFunction } from 'express';
import { RepaymentScheduleService } from './repayment-schedule.service';
import { Types } from 'mongoose';

export class RepaymentScheduleController {
  private service: RepaymentScheduleService;

  constructor() {
    this.service = new RepaymentScheduleService();
  }

  public getScheduleByLoanId = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const schedule = await this.service.getScheduleByLoanId(
        new Types.ObjectId(req.params.loanId),
      );

      res.status(200).json({
        success: true,
        data: schedule,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getUpcomingPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const schedules = await this.service.getUpcomingPayments(days);

      res.status(200).json({
        success: true,
        data: schedules,
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
