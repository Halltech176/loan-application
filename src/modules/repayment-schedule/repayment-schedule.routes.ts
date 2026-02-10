import { Router } from 'express';
import { RepaymentScheduleController } from './repayment-schedule.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';

const router = Router();
const controller = new RepaymentScheduleController();

router.get(
  '/upcoming-payments',
  authGuard,
  permissionGuard('repayment_schedule:read'),
  controller.getUpcomingPayments,
);
router.get(
  '/loan/:loanId',
  authGuard,
  permissionGuard('repayment_schedule:read'),
  controller.getScheduleByLoanId,
);

export { router as repaymentScheduleRouter };
