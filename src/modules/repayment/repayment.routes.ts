import { Router } from 'express';
import { RepaymentController } from './repayment.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { idempotencyGuard } from '../../shared/guards/idempotency.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateRepaymentDto, RecordPaymentDto } from './dto/repayment.dto';

const router = Router();
const controller = new RepaymentController();

router.post(
  '/',
  authGuard,
  permissionGuard('payment:create'),
  idempotencyGuard,
  validateDto(CreateRepaymentDto),
  controller.create
);

router.get(
  '/:id',
  authGuard,
  permissionGuard('payment:read'),
  controller.getOne
);

router.get(
  '/loan/:loanId',
  authGuard,
  permissionGuard('payment:read'),
  controller.getLoanRepayments
);

router.post(
  '/:id/record-payment',
  authGuard,
  permissionGuard('payment:create'),
  idempotencyGuard,
  validateDto(RecordPaymentDto),
  controller.recordPayment
);

export { router as repaymentRouter };
