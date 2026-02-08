import { Router } from 'express';
import { DisbursementController } from './disbursement.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { idempotencyGuard } from '../../shared/guards/idempotency.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateDisbursementDto } from './dto/disbursement.dto';

const router = Router();
const controller = new DisbursementController();

router.post(
  '/',
  authGuard,
  permissionGuard('loan:disburse'),
  idempotencyGuard,
  validateDto(CreateDisbursementDto),
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

export { router as disbursementRouter };
