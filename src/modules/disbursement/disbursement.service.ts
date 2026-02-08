import { DisbursementRepository } from './disbursement.repository';
import { IDisbursement, DisbursementStatus } from './disbursement.model';
import { CreateDisbursementDto } from './dto/disbursement.dto';
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

export class DisbursementService {
  private repository: DisbursementRepository;
  private loanRepository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;

  constructor() {
    this.repository = new DisbursementRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async createDisbursement(
    userId: string,
    dto: CreateDisbursementDto,
  ): Promise<IDisbursement> {
    return await this.distributedLock.executeWithLock(
      `disbursement:${dto.loanApplicationId}`,
      async () => {
        const loan = await this.loanRepository.findById(dto.loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        if (loan.status !== LoanStatus.APPROVED) {
          throw new UnprocessableEntityError(
            'Loan must be approved before disbursement',
            'LOAN_NOT_APPROVED',
          );
        }

        const existing = await this.repository.findByLoanApplicationId(dto.loanApplicationId);

        if (existing) {
          throw new ConflictError('Loan has already been disbursed', 'LOAN_ALREADY_DISBURSED');
        }

        const disbursement = await this.repository.create({
          ...dto,
          disbursedBy: userId,
          status: DisbursementStatus.PENDING,
        });

        await this.processDisbursement(disbursement.id);

        await this.eventPublisher.publish({
          eventType: 'disbursement.created',
          aggregateType: 'disbursement',
          aggregateId: disbursement.id,
          payload: {
            loanApplicationId: dto.loanApplicationId,
            amount: dto.amount,
          },
          userId,
        });

        return disbursement;
      },
    );
  }

  private async processDisbursement(disbursementId: string): Promise<void> {
    const disbursement = await this.repository.findById(new Types.ObjectId(disbursementId));

    if (!disbursement) {
      return;
    }

    await this.repository.update(new Types.ObjectId(disbursementId), {
      status: DisbursementStatus.PROCESSING,
    });

    try {
      const transactionReference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.COMPLETED,
        transactionReference,
        disbursedAt: new Date(),
      });

      await this.loanRepository.updateStatus(
        disbursement.loanApplicationId,
        LoanStatus.DISBURSED,
        new Types.ObjectId(disbursement.disbursedBy),
        'Loan disbursed successfully',
      );

      await this.eventPublisher.publish({
        eventType: 'disbursement.completed',
        aggregateType: 'disbursement',
        aggregateId: disbursementId,
        payload: {
          loanApplicationId: disbursement.loanApplicationId,
          transactionReference,
        },
      });
    } catch (error) {
      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.FAILED,
        failureReason: 'Disbursement processing failed',
      });

      await this.eventPublisher.publish({
        eventType: 'disbursement.failed',
        aggregateType: 'disbursement',
        aggregateId: disbursementId,
        payload: {
          loanApplicationId: disbursement.loanApplicationId,
          error: 'Processing failed',
        },
      });
    }
  }

  public async getDisbursement(id: string): Promise<IDisbursement> {
    const disbursement = await this.repository.findById(new Types.ObjectId(id));

    if (!disbursement) {
      throw new NotFoundError('Disbursement');
    }

    return disbursement;
  }

  public async getDisbursementByLoanId(loanApplicationId: string): Promise<IDisbursement> {
    const disbursement = await this.repository.findByLoanApplicationId(
      new Types.ObjectId(loanApplicationId),
    );

    if (!disbursement) {
      throw new NotFoundError('Disbursement');
    }

    return disbursement;
  }
}
