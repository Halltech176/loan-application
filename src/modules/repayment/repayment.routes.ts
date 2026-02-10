import { Router } from 'express';
import { RepaymentController } from './repayment.controller';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { idempotencyGuard } from '../../shared/guards/idempotency.guard';
import { validateDto } from '../../shared/middleware/validation';
import { RecordPaymentDto } from './dto/repayment.dto';
import { roleGuard } from '@/shared/guards/role.guard';
import { UserRole } from '../user/user.model';

const router = Router();
const controller = new RepaymentController();

router.post(
  '/process-payment',
  roleGuard(UserRole.CUSTOMER),
  idempotencyGuard,
  validateDto(RecordPaymentDto),
  controller.processPayment,
);

router.get(
  '/:id',
  roleGuard(UserRole.CUSTOMER),
  permissionGuard('payment:read'),
  controller.getOne,
);

router.get(
  '/loan/:loanId',
  roleGuard(UserRole.CUSTOMER),
  permissionGuard('payment:read'),
  controller.getLoanRepayments,
);

router.post(
  '/:id/record-payment',
  roleGuard(UserRole.CUSTOMER),
  idempotencyGuard,
  validateDto(RecordPaymentDto),
  controller.recordPayment,
);

export { router as repaymentRouter };
