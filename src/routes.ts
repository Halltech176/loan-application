import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/user/user.routes';
import { loanApplicationRouter } from './modules/loan-application/loan-application.routes';
import { creditApprovalRouter } from './modules/credit-approval/credit-approval.routes';
import { disbursementRouter } from './modules/disbursement/disbursement.routes';
import { repaymentRouter } from './modules/repayment/repayment.routes';
import { customerRouter } from './modules/customer/customer.routes';
import { repaymentScheduleRouter } from './modules/repayment-schedule/repayment-schedule.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/loan-applications', loanApplicationRouter);
router.use('/credit-approvals', creditApprovalRouter);
router.use('/disbursements', disbursementRouter);
router.use('/repayments', repaymentRouter);
router.use('/customer', customerRouter);
router.use('/repayment-schedule', repaymentScheduleRouter);

export { router };
