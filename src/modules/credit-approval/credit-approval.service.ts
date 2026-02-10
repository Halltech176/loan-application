import { CreditApprovalRepository } from './credit-approval.repository';
import { CreditDecision, ICreditApproval } from './credit-approval.model';
import { CreateCreditApprovalDto } from './dto/credit-approval.dto';
import {
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { LoanApplicationRepository } from '../loan-application/loan-application.repository';
import { LoanStatus } from '../loan-application/loan-application.model';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';

interface AutomatedApprovalCriteria {
  minCreditScore: number;
  maxAmount: number;
  minAmount: number;
  maxTerm: number;
  minTerm: number;
}

export class CreditApprovalService {
  private repository: CreditApprovalRepository;
  private loanRepository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;
  private readonly SYSTEM_USER_ID = new Types.ObjectId('000000000000000000000000');

  private readonly approvalCriteria: AutomatedApprovalCriteria = {
    minCreditScore: 600,
    maxAmount: 1000000,
    minAmount: 1000,
    maxTerm: 60,
    minTerm: 6,
  };

  constructor() {
    this.repository = new CreditApprovalRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async processAutomatedApproval(
    loanApplicationId: Types.ObjectId,
  ): Promise<ICreditApproval> {
    return await this.distributedLock.executeWithLock(
      `credit-approval:${loanApplicationId}`,
      async () => {
        const loan = await this.loanRepository.findById(loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        if (loan.status !== LoanStatus.SUBMITTED) {
          throw new UnprocessableEntityError(
            'Loan must be in submitted status for automated approval',
            'INVALID_LOAN_STATUS',
          );
        }

        const existing = await this.repository.findByLoanApplicationId(loanApplicationId);

        if (existing) {
          throw new ConflictError(
            'Credit approval already exists for this loan',
            'APPROVAL_ALREADY_EXISTS',
          );
        }

        await this.loanRepository.updateStatus(
          loanApplicationId,
          LoanStatus.UNDER_REVIEW,
          this.SYSTEM_USER_ID,
          'Automated credit approval in progress',
        );

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const decision = this.evaluateCreditApplication(loan.creditScore, loan.amount, loan.term);

        const notes = this.generateApprovalNotes(
          loan.creditScore,
          loan.amount,
          loan.term,
          decision,
        );

        const approval = await this.repository.create({
          loanApplicationId,
          decision,
          creditScore: loan.creditScore,
          debtToIncomeRatio: loan.debtToIncomeRatio,
          approvedInterestRate: loan.interestRate,
          approvedAmount: loan.amount,
          notes,
          reviewedBy: this.SYSTEM_USER_ID,
          reviewedAt: new Date(),
        });

        if (decision === CreditDecision.APPROVED) {
          await this.loanRepository.updateStatus(
            loanApplicationId,
            LoanStatus.APPROVED,
            this.SYSTEM_USER_ID,
            'Automatically approved based on credit criteria',
          );
          await this.eventPublisher.publish({
            eventType: 'loan_application.approved',
            aggregateType: 'loan_application',
            aggregateId: String(loanApplicationId),
            payload: {
              amount: loan.amount,
              term: loan.term,
              applicantId: loan.applicantId,
            },
            userId: String(this.SYSTEM_USER_ID),
          });
        } else {
          await this.loanRepository.updateStatus(
            loanApplicationId,
            LoanStatus.REJECTED,
            this.SYSTEM_USER_ID,
            notes,
          );
        }

        await this.eventPublisher.publish({
          eventType: 'credit_approval.created',
          aggregateType: 'credit_approval',
          aggregateId: approval.id,
          payload: {
            loanApplicationId,
            decision,
            creditScore: loan.creditScore,
            automated: true,
          },
          userId: String(this.SYSTEM_USER_ID),
        });

        return approval;
      },
    );
  }

  private evaluateCreditApplication(
    creditScore: number,
    amount: number,
    term: number,
  ): CreditDecision {
    if (creditScore < this.approvalCriteria.minCreditScore) {
      return CreditDecision.REJECTED;
    }

    if (amount < this.approvalCriteria.minAmount || amount > this.approvalCriteria.maxAmount) {
      return CreditDecision.REJECTED;
    }

    if (term < this.approvalCriteria.minTerm || term > this.approvalCriteria.maxTerm) {
      return CreditDecision.REJECTED;
    }

    const scoreThresholds = [
      { minScore: 750, maxAmount: 1000000 },
      { minScore: 700, maxAmount: 500000 },
      { minScore: 650, maxAmount: 250000 },
      { minScore: 600, maxAmount: 100000 },
    ];

    for (const threshold of scoreThresholds) {
      if (creditScore >= threshold.minScore && amount <= threshold.maxAmount) {
        return CreditDecision.APPROVED;
      }
    }

    return CreditDecision.REJECTED;
  }

  private generateApprovalNotes(
    creditScore: number,
    amount: number,
    term: number,
    decision: CreditDecision,
  ): string {
    const parts: string[] = [];

    if (decision === CreditDecision.APPROVED) {
      parts.push('Application approved by automated credit system.');
      parts.push(`Credit score: ${creditScore} (meets minimum requirement).`);
      parts.push(`Loan amount: ${amount} (within approved limits).`);
      parts.push(`Loan term: ${term} months (acceptable).`);
    } else {
      parts.push('Application rejected by automated credit system.');

      if (creditScore < this.approvalCriteria.minCreditScore) {
        parts.push(
          `Credit score: ${creditScore} (below minimum requirement of ${this.approvalCriteria.minCreditScore}).`,
        );
      }

      if (amount < this.approvalCriteria.minAmount) {
        parts.push(`Loan amount: ${amount} (below minimum of ${this.approvalCriteria.minAmount}).`);
      }

      if (amount > this.approvalCriteria.maxAmount) {
        parts.push(
          `Loan amount: ${amount} (exceeds maximum of ${this.approvalCriteria.maxAmount}).`,
        );
      }

      const scoreThresholds = [
        { minScore: 750, maxAmount: 1000000 },
        { minScore: 700, maxAmount: 500000 },
        { minScore: 650, maxAmount: 250000 },
        { minScore: 600, maxAmount: 100000 },
      ];

      for (const threshold of scoreThresholds) {
        if (creditScore >= threshold.minScore && amount > threshold.maxAmount) {
          parts.push(
            `Requested amount exceeds limit for credit score ${creditScore} (max: ${threshold.maxAmount}).`,
          );
          break;
        }
      }
    }

    return parts.join(' ');
  }

  public async createApproval(
    reviewerId: Types.ObjectId,
    dto: CreateCreditApprovalDto,
  ): Promise<ICreditApproval> {
    return await this.distributedLock.executeWithLock(
      `credit-approval:${dto.loanApplicationId}`,
      async () => {
        const loan = await this.loanRepository.findById(dto.loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        if (loan.status !== LoanStatus.SUBMITTED && loan.status !== LoanStatus.UNDER_REVIEW) {
          throw new UnprocessableEntityError(
            'Loan must be in submitted or under review status for credit approval',
            'INVALID_LOAN_STATUS',
          );
        }

        const existing = await this.repository.findByLoanApplicationId(dto.loanApplicationId);

        if (existing) {
          throw new ConflictError(
            'Credit approval already exists for this loan',
            'APPROVAL_ALREADY_EXISTS',
          );
        }

        const approval = await this.repository.create({
          ...dto,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        });

        if (dto.decision === CreditDecision.APPROVED) {
          await this.loanRepository.updateStatus(
            dto.loanApplicationId,
            LoanStatus.APPROVED,
            reviewerId,
            dto.notes || 'Manually approved',
          );
        } else if (dto.decision === CreditDecision.REJECTED) {
          await this.loanRepository.updateStatus(
            dto.loanApplicationId,
            LoanStatus.REJECTED,
            reviewerId,
            dto.notes || 'Manually rejected',
          );
        }

        await this.eventPublisher.publish({
          eventType: 'credit_approval.created',
          aggregateType: 'credit_approval',
          aggregateId: approval.id,
          payload: {
            loanApplicationId: dto.loanApplicationId,
            decision: dto.decision,
            creditScore: dto.creditScore,
            automated: false,
          },
          userId: String(reviewerId),
        });

        return approval;
      },
    );
  }

  public async getApproval(id: Types.ObjectId): Promise<ICreditApproval> {
    const approval = await this.repository.findById(id);

    if (!approval) {
      throw new NotFoundError('Credit Approval');
    }

    return approval;
  }

  public async getApprovalByLoanId(loanApplicationId: Types.ObjectId): Promise<ICreditApproval> {
    const approval = await this.repository.findByLoanApplicationId(loanApplicationId);

    if (!approval) {
      throw new NotFoundError('Credit Approval');
    }

    return approval;
  }

  public async updateApproval(
    id: Types.ObjectId,
    reviewerId: Types.ObjectId,
    dto: Partial<CreateCreditApprovalDto>,
  ): Promise<ICreditApproval> {
    return await this.distributedLock.executeWithLock(`credit-approval:update:${id}`, async () => {
      const approval = await this.repository.findById(id);

      if (!approval) {
        throw new NotFoundError('Credit Approval');
      }

      const loan = await this.loanRepository.findById(approval.loanApplicationId);

      if (!loan) {
        throw new NotFoundError('Loan Application');
      }

      if (loan.status === LoanStatus.DISBURSED || loan.status === LoanStatus.CLOSED) {
        throw new UnprocessableEntityError(
          'Cannot update approval for disbursed or closed loans',
          'INVALID_LOAN_STATUS',
        );
      }

      const updated = await this.repository.update(id, {
        ...dto,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      });

      if (!updated) {
        throw new NotFoundError('Credit Approval');
      }

      if (dto.decision && dto.decision !== approval.decision) {
        if (dto.decision === CreditDecision.APPROVED) {
          await this.loanRepository.updateStatus(
            approval.loanApplicationId,
            LoanStatus.APPROVED,
            reviewerId,
            dto.notes || 'Credit approval updated to approved',
          );
        } else if (dto.decision === CreditDecision.REJECTED) {
          await this.loanRepository.updateStatus(
            approval.loanApplicationId,
            LoanStatus.REJECTED,
            reviewerId,
            dto.notes || 'Credit approval updated to rejected',
          );
        }
      }

      await this.eventPublisher.publish({
        eventType: 'credit_approval.updated',
        aggregateType: 'credit_approval',
        aggregateId: String(id),
        payload: {
          loanApplicationId: approval.loanApplicationId,
          changes: dto,
        },
        userId: String(reviewerId),
      });

      return updated;
    });
  }
}
