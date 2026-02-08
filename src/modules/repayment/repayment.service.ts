import { RepaymentRepository } from './repayment.repository';
import { IRepayment, PaymentStatus } from './repayment.model';
import { CreateRepaymentDto, RecordPaymentDto } from './dto/repayment.dto';
import { NotFoundError, UnprocessableEntityError } from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { LoanApplicationRepository } from '../loan-application/loan-application.repository';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';

export class RepaymentService {
  private repository: RepaymentRepository;
  private loanRepository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;

  constructor() {
    this.repository = new RepaymentRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async createRepayment(userId: string, dto: CreateRepaymentDto): Promise<IRepayment> {
    const loan = await this.loanRepository.findById(new Types.ObjectId(dto.loanApplicationId));

    if (!loan) {
      throw new NotFoundError('Loan Application');
    }

    const repayment = await this.repository.create({
      ...dto,
      status: PaymentStatus.PENDING,
    });

    await this.eventPublisher.publish({
      eventType: 'repayment.created',
      aggregateType: 'repayment',
      aggregateId: repayment.id,
      payload: {
        loanApplicationId: dto.loanApplicationId,
        amount: dto.amount,
        dueDate: dto.dueDate,
      },
      userId,
    });

    return repayment;
  }

  public async recordPayment(
    id: string,
    userId: string,
    dto: RecordPaymentDto,
  ): Promise<IRepayment> {
    return await this.distributedLock.executeWithLock(`repayment:${id}`, async () => {
      const repayment = await this.repository.findById(id);

      if (!repayment) {
        throw new NotFoundError('Repayment');
      }

      if (repayment.status !== PaymentStatus.PENDING) {
        throw new UnprocessableEntityError(
          'Payment has already been processed',
          'PAYMENT_ALREADY_PROCESSED',
        );
      }

      const updated = await this.repository.update(id, {
        status: PaymentStatus.COMPLETED,
        paidDate: new Date(),
        paidBy: userId,
        paymentMethod: dto.paymentMethod,
        transactionReference: dto.transactionReference,
        notes: dto.notes,
      });

      if (!updated) {
        throw new NotFoundError('Repayment');
      }

      await this.eventPublisher.publish({
        eventType: 'repayment.completed',
        aggregateType: 'repayment',
        aggregateId: id,
        payload: {
          loanApplicationId: updated.loanApplicationId,
          amount: updated.amount,
          paymentMethod: dto.paymentMethod,
        },
        userId,
      });

      return updated;
    });
  }

  public async getRepayment(id: string): Promise<IRepayment> {
    const repayment = await this.repository.findById(id);

    if (!repayment) {
      throw new NotFoundError('Repayment');
    }

    return repayment;
  }

  public async getLoanRepayments(
    loanApplicationId: string,
    options: QueryOptions,
  ): Promise<PaginatedResult<IRepayment>> {
    return await this.repository.findByLoanApplicationId(loanApplicationId, options);
  }
}
