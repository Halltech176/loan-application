import { Router } from 'express';
import { CreditApprovalController } from './credit-approval.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { idempotencyGuard } from '../../shared/guards/idempotency.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateCreditApprovalDto } from './dto/credit-approval.dto';

const router = Router();
const controller = new CreditApprovalController();

router.post(
  '/',
  authGuard,
  permissionGuard('loan:approve'),
  idempotencyGuard,
  validateDto(CreateCreditApprovalDto),
  controller.create
);

router.get(
  '/:id',
  authGuard,
  permissionGuard('loan:read'),
  controller.getOne
);

router.get(
  '/loan/:loanId',
  authGuard,
  permissionGuard('loan:read'),
  controller.getByLoanId
);

export { router as creditApprovalRouter };
