import { RepaymentRepository } from './repayment.repository';
import { IRepayment, PaymentStatus } from './repayment.model';
import { CreateRepaymentDto, RecordPaymentDto } from './dto/repayment.dto';
import { NotFoundError, UnprocessableEntityError } from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { LoanApplicationRepository } from '../loan-application/loan-application.repository';
import { RepaymentScheduleService } from '../repayment-schedule/repayment-schedule.service';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';
import { IRepaymentSchedule } from '../repayment-schedule/repayment-schedule.model';

export class RepaymentService {
  private repository: RepaymentRepository;
  private loanRepository: LoanApplicationRepository;
  private repaymentScheduleService: RepaymentScheduleService;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;

  constructor() {
    this.repository = new RepaymentRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.repaymentScheduleService = new RepaymentScheduleService();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async processPayment(
    userId: Types.ObjectId,
    loanApplicationId: Types.ObjectId,
    dto: RecordPaymentDto,
  ): Promise<{ repayment: IRepayment; schedule: any }> {
    return await this.distributedLock.executeWithLock(
      `repayment:${loanApplicationId}`,
      async () => {
        const loan = await this.loanRepository.findById(loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        const schedule = await this.repaymentScheduleService.getScheduleByLoanId(loanApplicationId);

        if (!schedule) {
          throw new NotFoundError('Repayment Schedule');
        }

        const nextInstallment = schedule.installments.find(
          (inst) => inst.status === 'pending' || inst.status === 'partially_paid',
        );

        if (!nextInstallment) {
          throw new UnprocessableEntityError(
            'No pending installments found',
            'NO_PENDING_INSTALLMENTS',
          );
        }

        const repayment = await this.repository.create({
          loanApplicationId: String(loanApplicationId),
          amount: dto.amount,
          principalAmount: nextInstallment.principalAmount,
          interestAmount: nextInstallment.interestAmount,
          dueDate: nextInstallment.dueDate,
          paidDate: new Date(),
          status: PaymentStatus.COMPLETED,
          paymentMethod: dto.paymentMethod,
          transactionReference: dto.transactionReference,
          paidBy: String(userId),
          notes: dto.notes,
        });

        const updatedSchedule = await this.repaymentScheduleService.recordPayment(
          new Types.ObjectId(schedule.id),
          dto.amount,
          dto.transactionReference || repayment.id,
          userId,
        );

        await this.eventPublisher.publish({
          eventType: 'repayment.completed',
          aggregateType: 'repayment',
          aggregateId: repayment.id,
          payload: {
            loanApplicationId: String(loanApplicationId),
            amount: dto.amount,
            paymentMethod: dto.paymentMethod,
            transactionReference: dto.transactionReference,
          },
          userId: String(userId),
        });

        return {
          repayment,
          schedule: updatedSchedule,
        };
      },
    );
  }

  public async processRefund(
    repaymentId: string,
    userId: Types.ObjectId,
    reason: string,
  ): Promise<IRepayment> {
    return await this.distributedLock.executeWithLock(
      `repayment:refund:${repaymentId}`,
      async () => {
        const repayment = await this.repository.findById(repaymentId);

        if (!repayment) {
          throw new NotFoundError('Repayment');
        }

        if (repayment.status !== PaymentStatus.COMPLETED) {
          throw new UnprocessableEntityError(
            'Can only refund completed payments',
            'INVALID_STATUS',
          );
        }

        const updated = await this.repository.update(repaymentId, {
          status: PaymentStatus.REFUNDED,
          notes: `${repayment.notes || ''} | Refunded: ${reason}`,
        });

        if (!updated) {
          throw new NotFoundError('Repayment');
        }

        await this.eventPublisher.publish({
          eventType: 'repayment.refunded',
          aggregateType: 'repayment',
          aggregateId: repaymentId,
          payload: {
            loanApplicationId: repayment.loanApplicationId,
            amount: repayment.amount,
            reason,
          },
          userId: String(userId),
        });

        return updated;
      },
    );
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

  public async getOverdueRepayments(): Promise<IRepaymentSchedule[]> {
    return await this.repaymentScheduleService.getOverdueSchedules();
  }

  public async getUpcomingRepayments(days: number): Promise<IRepaymentSchedule[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return await this.repaymentScheduleService.getUpcomingPayments(days);
  }
}
