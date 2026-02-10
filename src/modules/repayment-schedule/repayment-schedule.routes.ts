import { Router } from 'express';
import { RepaymentScheduleController } from './repayment-schedule.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { roleGuard } from '@/shared/guards/role.guard';
import { UserRole } from '../user/user.model';

const router = Router();
const controller = new RepaymentScheduleController();

router.get(
  '/upcoming-payments',
  authGuard,
  permissionGuard('repayment_schedule:read'),
  controller.getUpcomingPayments,
);
router.get('/loan/:loanId', roleGuard(UserRole.CUSTOMER), controller.getScheduleByLoanId);

export { router as repaymentScheduleRouter };
