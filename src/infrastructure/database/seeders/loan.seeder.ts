import { Logger } from '@/infrastructure/logging/logger';
import {
  LoanApplicationModel,
  LoanPurpose,
  LoanStatus,
} from '@/modules/loan-application/loan-application.model';
import { UserModel, UserRole, UserStatus } from '@/modules/user/user.model';

const logger = Logger.getInstance();

export class LoanSeeder {
  async seed(): Promise<void> {
    try {
      const existingLoans = await LoanApplicationModel.countDocuments();
      if (existingLoans > 0) {
        logger.info('Loans already exist, skipping loan seeding');
        return;
      }

      const customers = await UserModel.find({
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      });
      if (customers.length === 0) {
        logger.warn('No customers found, skipping loan seeding');
        return;
      }

      const officers = await UserModel.find({ role: UserRole.LOAN_OFFICER });
      const officerId = officers.length > 0 ? officers[0]._id.toString() : undefined;

      const loans = [
        {
          applicantId: customers[0]._id.toString(),
          amount: 50000,
          term: 24,
          purpose: LoanPurpose.BUSINESS,
          purposeDescription: 'Expanding my retail business',
          status: LoanStatus.SUBMITTED,
          interestRate: 0,
          outstandingBalance: 0,
          decisionHistory: [],
        },
        {
          applicantId: customers[0]._id.toString(),
          amount: 25000,
          term: 12,
          purpose: LoanPurpose.PERSONAL,
          purposeDescription: 'Home renovation',
          status: LoanStatus.APPROVED,
          interestRate: 12.5,
          monthlyInstallment: 2225.55,
          totalRepayable: 26706.6,
          outstandingBalance: 26706.6,
          approvedBy: officerId,
          approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          decisionHistory: [
            {
              status: LoanStatus.APPROVED,
              decidedBy: officerId || 'system',
              reason: 'Good credit score and stable income',
              timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          applicantId: customers[1]._id.toString(),
          amount: 100000,
          term: 36,
          purpose: LoanPurpose.BUSINESS,
          purposeDescription: 'Starting a new tech company',
          status: LoanStatus.UNDER_REVIEW,
          interestRate: 0,
          outstandingBalance: 0,
          decisionHistory: [],
        },
        {
          applicantId: customers[1]._id.toString(),
          amount: 15000,
          term: 6,
          purpose: LoanPurpose.EDUCATION,
          purposeDescription: 'Professional certification course',
          status: LoanStatus.DISBURSED,
          interestRate: 10.0,
          monthlyInstallment: 2583.33,
          totalRepayable: 15500,
          outstandingBalance: 15500,
          disbursedAmount: 15000,
          disbursementReference: 'DISB-2024-001',
          disbursedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          approvedBy: officerId,
          approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          decisionHistory: [
            {
              status: LoanStatus.APPROVED,
              decidedBy: officerId || 'system',
              reason: 'Approved for educational purposes',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
            {
              status: LoanStatus.DISBURSED,
              decidedBy: officerId || 'system',
              timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          applicantId: customers[2]._id.toString(),
          amount: 75000,
          term: 48,
          purpose: LoanPurpose.HOME_IMPROVEMENT,
          purposeDescription: 'Kitchen and bathroom remodeling',
          status: LoanStatus.REJECTED,
          interestRate: 0,
          outstandingBalance: 0,
          rejectedBy: officerId,
          rejectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          rejectionReason: 'Insufficient credit history',
          decisionHistory: [
            {
              status: LoanStatus.REJECTED,
              decidedBy: officerId || 'system',
              reason: 'Insufficient credit history',
              timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          applicantId: customers[2]._id.toString(),
          amount: 30000,
          term: 18,
          purpose: LoanPurpose.DEBT_CONSOLIDATION,
          purposeDescription: 'Consolidating credit card debt',
          status: LoanStatus.ACTIVE,
          interestRate: 14.5,
          monthlyInstallment: 1916.67,
          totalRepayable: 34500,
          outstandingBalance: 20700,
          disbursedAmount: 30000,
          disbursementReference: 'DISB-2024-002',
          disbursedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          approvedBy: officerId,
          approvedAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
          decisionHistory: [
            {
              status: LoanStatus.APPROVED,
              decidedBy: officerId || 'system',
              reason: 'Approved for debt consolidation',
              timestamp: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
            },
            {
              status: LoanStatus.DISBURSED,
              decidedBy: officerId || 'system',
              timestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
            {
              status: LoanStatus.ACTIVE,
              decidedBy: 'system',
              reason: 'First repayment received',
              timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ];

      for (const loanData of loans) {
        const loan = new LoanApplicationModel(loanData);
        await loan.save();
        logger.info('Loan seeded', {
          loanId: loan._id,
          applicantId: loan.applicantId,
          status: loan.status,
        });
      }

      logger.info(`Successfully seeded ${loans.length} loans`);
    } catch (error) {
      logger.error('Failed to seed loans', error as Error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await LoanApplicationModel.deleteMany({});
      logger.info('Loans cleared from database');
    } catch (error) {
      logger.error('Failed to clear loans', error as Error);
      throw error;
    }
  }
}
