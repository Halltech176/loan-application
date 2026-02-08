import { Router } from 'express';
import { LoanApplicationController } from './loan-application.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { idempotencyGuard } from '../../shared/guards/idempotency.guard';
import { validateDto } from '../../shared/middleware/validation';
import {
  CreateLoanApplicationDto,
  UpdateLoanApplicationDto,
  ReviewLoanApplicationDto,
} from './dto/loan-application.dto';
import { roleGuard } from '@/shared/guards/role.guard';
import { UserRole } from '../user/user.model';

const router = Router();
const controller = new LoanApplicationController();

router.post(
  '/',
  roleGuard(UserRole.CUSTOMER),
  idempotencyGuard,
  validateDto(CreateLoanApplicationDto),
  controller.create,
);

router.get('/', roleGuard(UserRole.ADMIN, UserRole.LOAN_OFFICER), controller.getAll);

router.get('/my-applications', authGuard, controller.getUserApplications);

router.get('/:id', authGuard, permissionGuard('loan:read'), controller.getOne);

router.put(
  '/:id',
  authGuard,
  permissionGuard('loan:update'),
  validateDto(UpdateLoanApplicationDto),
  controller.update,
);

router.post(
  '/:id/submit',
  authGuard,
  permissionGuard('loan:create'),
  idempotencyGuard,
  controller.submit,
);

router.post(
  '/:id/review',
  authGuard,
  permissionGuard('loan:approve'),
  idempotencyGuard,
  validateDto(ReviewLoanApplicationDto),
  controller.review,
);

router.delete('/:id', authGuard, permissionGuard('loan:delete'), controller.delete);

export { router as loanApplicationRouter };
