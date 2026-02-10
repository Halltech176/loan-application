import { RepaymentScheduleRepository } from './repayment-schedule.repository';
import {
  IRepaymentSchedule,
  RepaymentFrequency,
  ScheduleStatus,
  IScheduleInstallment,
} from './repayment-schedule.model';
import {
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { DisbursementRepository } from '../disbursement/disbursement.repository';
import { LoanApplicationRepository } from '../loan-application/loan-application.repository';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';

export class RepaymentScheduleService {
  private repository: RepaymentScheduleRepository;
  private disbursementRepository: DisbursementRepository;
  private loanRepository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;
  private readonly SYSTEM_USER_ID = new Types.ObjectId('000000000000000000000000');

  constructor() {
    this.repository = new RepaymentScheduleRepository();
    this.disbursementRepository = new DisbursementRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  public async generateScheduleFromDisbursement(
    disbursementId: Types.ObjectId,
  ): Promise<IRepaymentSchedule> {
    return await this.distributedLock.executeWithLock(
      `repayment-schedule:${disbursementId}`,
      async () => {
        const disbursement = await this.disbursementRepository.findById(disbursementId);

        if (!disbursement) {
          throw new NotFoundError('Disbursement');
        }

        const loan = await this.loanRepository.findById(disbursement.loanApplicationId);

        if (!loan) {
          throw new NotFoundError('Loan Application');
        }

        const existing = await this.repository.findByLoanApplicationId(
          String(disbursement.loanApplicationId),
        );

        if (existing) {
          throw new ConflictError(
            'Repayment schedule already exists for this loan',
            'SCHEDULE_ALREADY_EXISTS',
          );
        }

        const frequency = RepaymentFrequency.MONTHLY;
        const installments = this.calculateInstallments(
          loan.amount,
          loan.interestRate,
          loan.term,
          frequency,
          disbursement.disbursedAt || new Date(),
        );

        const summary = this.calculateSummary(installments);

        const schedule = await this.repository.create({
          loanApplicationId: disbursement.loanApplicationId,
          disbursementId: disbursementId,
          userId: loan.applicantId,
          loanDetails: {
            principalAmount: loan.amount,
            interestRate: loan.interestRate,
            term: loan.term,
            frequency,
          },
          installments,
          summary,
          status: ScheduleStatus.ACTIVE,
          startDate: disbursement.disbursedAt || new Date(),
          endDate: installments[installments.length - 1].dueDate,
          nextPaymentDate: installments[0].dueDate,
          earlyRepayment: {
            isEarlyRepayment: false,
          },
        });

        await this.eventPublisher.publish({
          eventType: 'repayment_schedule.created',
          aggregateType: 'repayment_schedule',
          aggregateId: schedule.id,
          payload: {
            loanApplicationId: String(disbursement.loanApplicationId),
            disbursementId: String(disbursementId),
            numberOfInstallments: installments.length,
            totalAmount: summary.totalAmount,
          },
          userId: String(this.SYSTEM_USER_ID),
        });

        return schedule;
      },
    );
  }

  private calculateInstallments(
    principal: number,
    annualRate: number,
    termMonths: number,
    frequency: RepaymentFrequency,
    startDate: Date,
  ): IScheduleInstallment[] {
    const installments: IScheduleInstallment[] = [];
    const monthlyRate = annualRate / 100 / 12;

    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    let remainingPrincipal = principal;
    let currentDate = new Date(startDate);

    for (let i = 1; i <= termMonths; i++) {
      currentDate = this.getNextPaymentDate(currentDate, frequency, i === 1);

      const interestAmount = remainingPrincipal * monthlyRate;
      const principalAmount = monthlyPayment - interestAmount;

      if (i === termMonths) {
        const totalAmount = remainingPrincipal + interestAmount;
        installments.push({
          installmentNumber: i,
          dueDate: new Date(currentDate),
          principalAmount: remainingPrincipal,
          interestAmount: parseFloat(interestAmount.toFixed(2)),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          paidAmount: 0,
          outstandingAmount: parseFloat(totalAmount.toFixed(2)),
          status: 'pending',
        });
      } else {
        installments.push({
          installmentNumber: i,
          dueDate: new Date(currentDate),
          principalAmount: parseFloat(principalAmount.toFixed(2)),
          interestAmount: parseFloat(interestAmount.toFixed(2)),
          totalAmount: parseFloat(monthlyPayment.toFixed(2)),
          paidAmount: 0,
          outstandingAmount: parseFloat(monthlyPayment.toFixed(2)),
          status: 'pending',
        });

        remainingPrincipal -= principalAmount;
      }
    }

    return installments;
  }

  private getNextPaymentDate(
    currentDate: Date,
    frequency: RepaymentFrequency,
    isFirst: boolean,
  ): Date {
    const date = new Date(currentDate);

    if (!isFirst) {
      switch (frequency) {
        case RepaymentFrequency.WEEKLY:
          date.setDate(date.getDate() + 7);
          break;
        case RepaymentFrequency.BI_WEEKLY:
          date.setDate(date.getDate() + 14);
          break;
        case RepaymentFrequency.MONTHLY:
          date.setMonth(date.getMonth() + 1);
          break;
      }
    } else {
      switch (frequency) {
        case RepaymentFrequency.WEEKLY:
          date.setDate(date.getDate() + 7);
          break;
        case RepaymentFrequency.BI_WEEKLY:
          date.setDate(date.getDate() + 14);
          break;
        case RepaymentFrequency.MONTHLY:
          date.setMonth(date.getMonth() + 1);
          break;
      }
    }

    return date;
  }

  private calculateSummary(installments: IScheduleInstallment[]) {
    return {
      totalPrincipal: parseFloat(
        installments.reduce((sum, inst) => sum + inst.principalAmount, 0).toFixed(2),
      ),
      totalInterest: parseFloat(
        installments.reduce((sum, inst) => sum + inst.interestAmount, 0).toFixed(2),
      ),
      totalAmount: parseFloat(
        installments.reduce((sum, inst) => sum + inst.totalAmount, 0).toFixed(2),
      ),
      paidAmount: 0,
      outstandingAmount: parseFloat(
        installments.reduce((sum, inst) => sum + inst.totalAmount, 0).toFixed(2),
      ),
      numberOfInstallments: installments.length,
      completedInstallments: 0,
      overdueInstallments: 0,
    };
  }

  public async recordPayment(
    scheduleId: Types.ObjectId,
    paymentAmount: number,
    paymentReference: string,
    userId: Types.ObjectId,
  ): Promise<IRepaymentSchedule> {
    return await this.distributedLock.executeWithLock(
      `repayment-schedule:payment:${scheduleId}`,
      async () => {
        const schedule = await this.repository.findById(String(scheduleId));

        if (!schedule) {
          throw new NotFoundError('Repayment Schedule');
        }

        if (schedule.status !== ScheduleStatus.ACTIVE) {
          throw new UnprocessableEntityError(
            'Cannot record payment for inactive schedule',
            'INACTIVE_SCHEDULE',
          );
        }

        let remainingPayment = paymentAmount;
        let updatedInstallments = [...schedule.installments];
        let installmentsPaid = 0;

        for (let i = 0; i < updatedInstallments.length; i++) {
          if (remainingPayment <= 0) break;

          const installment = updatedInstallments[i];

          if (installment.status === 'paid') continue;

          const outstandingAmount = installment.outstandingAmount;

          if (remainingPayment >= outstandingAmount) {
            installment.paidAmount = installment.totalAmount;
            installment.outstandingAmount = 0;
            installment.status = 'paid';
            installment.paidDate = new Date();
            installment.paymentReference = paymentReference;
            remainingPayment -= outstandingAmount;
            installmentsPaid++;
          } else {
            installment.paidAmount += remainingPayment;
            installment.outstandingAmount -= remainingPayment;
            installment.status = 'partially_paid';
            remainingPayment = 0;
          }
        }

        const newSummary = this.recalculateSummary(updatedInstallments);
        const nextPendingInstallment = updatedInstallments.find(
          (inst) => inst.status === 'pending' || inst.status === 'partially_paid',
        );

        const updatedSchedule = await this.repository.update(String(scheduleId), {
          installments: updatedInstallments,
          summary: newSummary,
          lastPaymentDate: new Date(),
          nextPaymentDate: nextPendingInstallment?.dueDate,
          status:
            newSummary.completedInstallments === schedule.summary.numberOfInstallments
              ? ScheduleStatus.COMPLETED
              : ScheduleStatus.ACTIVE,
        });

        if (!updatedSchedule) {
          throw new NotFoundError('Repayment Schedule');
        }

        await this.eventPublisher.publish({
          eventType: 'repayment_schedule.payment_recorded',
          aggregateType: 'repayment_schedule',
          aggregateId: String(scheduleId),
          payload: {
            loanApplicationId: schedule.loanApplicationId,
            paymentAmount,
            paymentReference,
            installmentsPaid,
            remainingBalance: newSummary.outstandingAmount,
          },
          userId: String(userId),
        });

        if (updatedSchedule.status === ScheduleStatus.COMPLETED) {
          await this.eventPublisher.publish({
            eventType: 'repayment_schedule.completed',
            aggregateType: 'repayment_schedule',
            aggregateId: String(scheduleId),
            payload: {
              loanApplicationId: schedule.loanApplicationId,
              totalPaid: newSummary.paidAmount,
            },
            userId: String(userId),
          });
        }

        return updatedSchedule;
      },
    );
  }

  private recalculateSummary(installments: IScheduleInstallment[]) {
    const paidAmount = installments.reduce((sum, inst) => sum + inst.paidAmount, 0);
    const outstandingAmount = installments.reduce((sum, inst) => sum + inst.outstandingAmount, 0);
    const completedInstallments = installments.filter((inst) => inst.status === 'paid').length;
    const overdueInstallments = installments.filter(
      (inst) =>
        (inst.status === 'pending' || inst.status === 'partially_paid') &&
        new Date(inst.dueDate) < new Date(),
    ).length;

    return {
      totalPrincipal: installments.reduce((sum, inst) => sum + inst.principalAmount, 0),
      totalInterest: installments.reduce((sum, inst) => sum + inst.interestAmount, 0),
      totalAmount: installments.reduce((sum, inst) => sum + inst.totalAmount, 0),
      paidAmount: parseFloat(paidAmount.toFixed(2)),
      outstandingAmount: parseFloat(outstandingAmount.toFixed(2)),
      numberOfInstallments: installments.length,
      completedInstallments,
      overdueInstallments,
    };
  }

  public async processEarlyRepayment(
    scheduleId: Types.ObjectId,
    paymentAmount: number,
    userId: Types.ObjectId,
  ): Promise<IRepaymentSchedule> {
    return await this.distributedLock.executeWithLock(
      `repayment-schedule:early:${scheduleId}`,
      async () => {
        const schedule = await this.repository.findById(String(scheduleId));

        if (!schedule) {
          throw new NotFoundError('Repayment Schedule');
        }

        const outstandingAmount = schedule.summary.outstandingAmount;
        const penaltyRate = 0.02;
        const penaltyAmount = outstandingAmount * penaltyRate;
        const totalRequired = outstandingAmount + penaltyAmount;

        if (paymentAmount < totalRequired) {
          throw new UnprocessableEntityError(
            `Insufficient amount for early repayment. Required: ${totalRequired}`,
            'INSUFFICIENT_AMOUNT',
          );
        }

        const updatedSchedule = await this.repository.update(String(scheduleId), {
          status: ScheduleStatus.COMPLETED,
          lastPaymentDate: new Date(),
          earlyRepayment: {
            isEarlyRepayment: true,
            earlyRepaymentDate: new Date(),
            earlyRepaymentAmount: paymentAmount,
            penaltyAmount,
          },
          summary: {
            ...schedule.summary,
            paidAmount: schedule.summary.totalAmount,
            outstandingAmount: 0,
            completedInstallments: schedule.summary.numberOfInstallments,
          },
        });

        if (!updatedSchedule) {
          throw new NotFoundError('Repayment Schedule');
        }

        await this.eventPublisher.publish({
          eventType: 'repayment_schedule.early_repayment',
          aggregateType: 'repayment_schedule',
          aggregateId: String(scheduleId),
          payload: {
            loanApplicationId: schedule.loanApplicationId,
            paymentAmount,
            penaltyAmount,
            savedInterest: schedule.summary.outstandingAmount - outstandingAmount,
          },
          userId: String(userId),
        });

        return updatedSchedule;
      },
    );
  }

  public async getSchedule(id: Types.ObjectId): Promise<IRepaymentSchedule> {
    const schedule = await this.repository.findById(String(id));

    if (!schedule) {
      throw new NotFoundError('Repayment Schedule');
    }

    return schedule;
  }

  public async getScheduleByLoanId(
    userId: Types.ObjectId,
    loanApplicationId: Types.ObjectId,
  ): Promise<IRepaymentSchedule> {
    const schedule = await this.repository.findByLoanApplicationIdAndUserId(
      String(userId),
      String(loanApplicationId),
    );

    if (!schedule) {
      throw new NotFoundError('Repayment Schedule');
    }

    return schedule;
  }

  public async getOverdueSchedules(): Promise<IRepaymentSchedule[]> {
    return await this.repository.findOverdueSchedules();
  }

  public async getUpcomingPayments(days: number): Promise<IRepaymentSchedule[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return await this.repository.findUpcomingPayments(days);
  }
}
