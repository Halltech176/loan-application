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
import { CustomerRepository } from '../customer/customer.repository';
import { LoanStatus } from '../loan-application/loan-application.model';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';

export class DisbursementService {
  private repository: DisbursementRepository;
  private loanRepository: LoanApplicationRepository;
  private customerRepository: CustomerRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;
  private readonly SYSTEM_USER_ID = new Types.ObjectId('000000000000000000000000');

  constructor() {
    this.repository = new DisbursementRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.customerRepository = new CustomerRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async processAutomatedDisbursement(
    loanApplicationId: Types.ObjectId,
  ): Promise<IDisbursement> {
    return await this.distributedLock.executeWithLock(
      `disbursement:${loanApplicationId}`,
      async () => {
        const loan = await this.loanRepository.findById(loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        if (loan.status !== LoanStatus.APPROVED) {
          throw new UnprocessableEntityError(
            'Loan must be approved before automated disbursement',
            'LOAN_NOT_APPROVED',
          );
        }

        const existing = await this.repository.findByLoanApplicationId(loanApplicationId);

        if (existing) {
          throw new ConflictError('Loan has already been disbursed', 'LOAN_ALREADY_DISBURSED');
        }

        const customer = await this.customerRepository.findCustomerByUserId(
          String(loan.applicantId),
        );

        if (!customer) {
          throw new NotFoundError('Customer');
        }

        if (!customer.isVerified) {
          throw new UnprocessableEntityError(
            'Customer must be verified before disbursement',
            'CUSTOMER_NOT_VERIFIED',
          );
        }

        const disbursement = await this.repository.create({
          loanApplicationId,
          amount: loan.amount,
          recipientAccount: {
            accountNumber: customer.bankDetails.accountNumber,
            accountName: customer.bankDetails.accountName,
            bankName: customer.bankDetails.bankName,
            bankCode: customer.bankDetails.bankCode,
          },
          disbursedBy: String(this.SYSTEM_USER_ID),
          status: DisbursementStatus.PENDING,
        });

        await this.eventPublisher.publish({
          eventType: 'disbursement.created',
          aggregateType: 'disbursement',
          aggregateId: disbursement.id,
          payload: {
            loanApplicationId,
            userId: String(this.SYSTEM_USER_ID),
          },
        });

        this.executeAutomatedDisbursement(disbursement.id, loanApplicationId);

        return disbursement;
      },
    );
  }

  private async executeAutomatedDisbursement(
    disbursementId: string,
    loanApplicationId: Types.ObjectId,
  ): Promise<void> {
    try {
      const disbursement = await this.repository.findById(new Types.ObjectId(disbursementId));

      if (!disbursement) {
        return;
      }

      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.PROCESSING,
      });

      await this.eventPublisher.publish({
        eventType: 'disbursement.processing',
        aggregateType: 'disbursement',
        aggregateId: disbursementId,
        payload: {
          loanApplicationId,
        },
        userId: String(this.SYSTEM_USER_ID),
      });

      const transactionReference = await this.simulatePaymentGateway(
        disbursement.amount,
        disbursement.recipientAccount,
      );

      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.COMPLETED,
        transactionReference,
        disbursedAt: new Date(),
      });

      await this.loanRepository.updateStatus(
        loanApplicationId,
        LoanStatus.DISBURSED,
        this.SYSTEM_USER_ID,
        `Loan disbursed successfully. Transaction ref: ${transactionReference}`,
      );

      await this.eventPublisher.publish({
        eventType: 'disbursement.completed',
        aggregateType: 'disbursement',
        aggregateId: disbursementId,
        payload: {
          loanApplicationId,
          transactionReference,
          amount: disbursement.amount,
        },
        userId: String(this.SYSTEM_USER_ID),
      });
    } catch (error) {
      await this.handleDisbursementFailure(disbursementId, loanApplicationId, error);
    }
  }

  private async simulatePaymentGateway(
    amount: number,
    recipientAccount: {
      accountNumber: string;
      accountName: string;
      bankName: string;
      bankCode: string;
    },
  ): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(
      `Simulating payment gateway for amount: ${amount}, recipient: ${recipientAccount.accountNumber} - ${recipientAccount.accountName} (${recipientAccount.bankName})`,
    );

    const isSuccess = Math.random() > 0.05;

    if (!isSuccess) {
      throw new Error('Payment gateway error: Transaction declined');
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `TXN-${timestamp}-${random}`;
  }

  private async handleDisbursementFailure(
    disbursementId: string,
    loanApplicationId: Types.ObjectId,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown disbursement error';

    await this.repository.update(new Types.ObjectId(disbursementId), {
      status: DisbursementStatus.FAILED,
      failureReason: errorMessage,
    });

    await this.loanRepository.updateStatus(
      loanApplicationId,
      LoanStatus.APPROVED,
      this.SYSTEM_USER_ID,
      `Disbursement failed: ${errorMessage}. Ready for retry.`,
    );

    await this.eventPublisher.publish({
      eventType: 'disbursement.failed',
      aggregateType: 'disbursement',
      aggregateId: disbursementId,
      payload: {
        loanApplicationId,
        error: errorMessage,
      },
      userId: String(this.SYSTEM_USER_ID),
    });
  }

  public async createDisbursement(
    userId: Types.ObjectId,
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
          disbursedBy: String(userId),
          status: DisbursementStatus.PENDING,
        });

        await this.eventPublisher.publish({
          eventType: 'disbursement.created',
          aggregateType: 'disbursement',
          aggregateId: disbursement.id,
          payload: {
            loanApplicationId: dto.loanApplicationId,
            amount: dto.amount,
            automated: false,
          },
          userId: String(userId),
        });

        this.processDisbursement(disbursement.id, userId);

        return disbursement;
      },
    );
  }

  private async processDisbursement(disbursementId: string, userId: Types.ObjectId): Promise<void> {
    try {
      const disbursement = await this.repository.findById(new Types.ObjectId(disbursementId));

      if (!disbursement) {
        return;
      }

      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.PROCESSING,
      });

      const transactionReference = await this.simulatePaymentGateway(
        disbursement.amount,
        disbursement.recipientAccount,
      );

      await this.repository.update(new Types.ObjectId(disbursementId), {
        status: DisbursementStatus.COMPLETED,
        transactionReference,
        disbursedAt: new Date(),
      });

      await this.loanRepository.updateStatus(
        disbursement.loanApplicationId,
        LoanStatus.DISBURSED,
        userId,
        `Loan disbursed successfully. Transaction ref: ${transactionReference}`,
      );

      await this.eventPublisher.publish({
        eventType: 'disbursement.completed',
        aggregateType: 'disbursement',
        aggregateId: disbursementId,
        payload: {
          loanApplicationId: disbursement.loanApplicationId,
          transactionReference,
        },
        userId: String(userId),
      });
    } catch (error) {
      await this.handleDisbursementFailure(
        disbursementId,
        new Types.ObjectId(
          String(
            (await this.repository.findById(new Types.ObjectId(disbursementId)))?.loanApplicationId,
          ),
        ),
        error,
      );
    }
  }

  public async getDisbursement(id: Types.ObjectId): Promise<IDisbursement> {
    const disbursement = await this.repository.findById(id);

    if (!disbursement) {
      throw new NotFoundError('Disbursement');
    }

    return disbursement;
  }

  public async getDisbursementByLoanId(loanApplicationId: Types.ObjectId): Promise<IDisbursement> {
    const disbursement = await this.repository.findByLoanApplicationId(loanApplicationId);

    if (!disbursement) {
      throw new NotFoundError('Disbursement');
    }

    return disbursement;
  }

  public async retryFailedDisbursement(
    id: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<IDisbursement> {
    return await this.distributedLock.executeWithLock(`disbursement:retry:${id}`, async () => {
      const disbursement = await this.repository.findById(id);

      if (!disbursement) {
        throw new NotFoundError('Disbursement');
      }

      if (disbursement.status !== DisbursementStatus.FAILED) {
        throw new UnprocessableEntityError('Can only retry failed disbursements', 'INVALID_STATUS');
      }

      await this.repository.update(id, {
        status: DisbursementStatus.PENDING,
        failureReason: undefined,
      });

      this.processDisbursement(String(id), userId);

      return await this.getDisbursement(id);
    });
  }
}
