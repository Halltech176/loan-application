import cron, { ScheduledTask } from 'node-cron';
import { RepaymentScheduleService } from '../modules/repayment-schedule/repayment-schedule.service';
import { EventPublisher } from '../infrastructure/events/event-publisher';
import { Logger } from '../infrastructure/logging/logger';

export class RepaymentReminderCron {
  private repaymentScheduleService: RepaymentScheduleService;
  private eventPublisher: EventPublisher;
  private logger: Logger;
  private jobs: ScheduledTask[] = [];

  constructor() {
    this.repaymentScheduleService = new RepaymentScheduleService();
    this.eventPublisher = new EventPublisher();
    this.logger = Logger.getInstance();
  }

  public start(): void {
    this.scheduleUpcomingPaymentReminders();
    this.scheduleOverduePaymentReminders();
    this.schedulePaymentDueReminders();

    this.logger.info('Repayment reminder cron jobs started');
  }

  private scheduleUpcomingPaymentReminders(): void {
    const job = cron.schedule('0 9 * * *', async () => {
      try {
        this.logger.info('Running upcoming payment reminders job');

        const schedules = await this.repaymentScheduleService.getUpcomingPayments(3);

        for (const schedule of schedules) {
          const nextInstallment = schedule.installments.find(
            (inst) => inst.status === 'pending' || inst.status === 'partially_paid',
          );

          if (nextInstallment) {
            const daysUntilDue = Math.ceil(
              (new Date(nextInstallment.dueDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            );

            await this.eventPublisher.publish({
              eventType: 'repayment_reminder.upcoming',
              aggregateType: 'repayment_schedule',
              aggregateId: schedule.id,
              payload: {
                loanApplicationId: schedule.loanApplicationId,
                userId: schedule.userId,
                dueDate: nextInstallment.dueDate,
                amount: nextInstallment.totalAmount,
                daysUntilDue,
                installmentNumber: nextInstallment.installmentNumber,
              },
              userId: String(schedule.userId),
            });
          }
        }

        this.logger.info(`Sent ${schedules.length} upcoming payment reminders`);
      } catch (error) {
        this.logger.error('Error in upcoming payment reminders job', { error });
      }
    });

    this.jobs.push(job);
  }

  private scheduleOverduePaymentReminders(): void {
    const job = cron.schedule('0 10 * * *', async () => {
      try {
        this.logger.info('Running overdue payment reminders job');

        const schedules = await this.repaymentScheduleService.getOverdueSchedules();

        for (const schedule of schedules) {
          const overdueInstallments = schedule.installments.filter(
            (inst) =>
              (inst.status === 'pending' || inst.status === 'partially_paid') &&
              new Date(inst.dueDate) < new Date(),
          );

          for (const installment of overdueInstallments) {
            const daysOverdue = Math.ceil(
              (new Date().getTime() - new Date(installment.dueDate).getTime()) /
                (1000 * 60 * 60 * 24),
            );

            await this.eventPublisher.publish({
              eventType: 'repayment_reminder.overdue',
              aggregateType: 'repayment_schedule',
              aggregateId: schedule.id,
              payload: {
                loanApplicationId: schedule.loanApplicationId,
                userId: schedule.userId,
                dueDate: installment.dueDate,
                amount: installment.outstandingAmount,
                daysOverdue,
                installmentNumber: installment.installmentNumber,
                totalOverdue: schedule.summary.overdueInstallments,
              },
              userId: String(schedule.userId),
            });
          }
        }

        this.logger.info(`Sent overdue payment reminders for ${schedules.length} schedules`);
      } catch (error) {
        this.logger.error('Error in overdue payment reminders job', { error });
      }
    });

    this.jobs.push(job);
  }

  private schedulePaymentDueReminders(): void {
    const job = cron.schedule('0 8 * * *', async () => {
      try {
        this.logger.info('Running payment due today reminders job');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const schedules = await this.repaymentScheduleService.getUpcomingPayments(1);

        for (const schedule of schedules) {
          const dueTodayInstallments = schedule.installments.filter(
            (inst) =>
              (inst.status === 'pending' || inst.status === 'partially_paid') &&
              new Date(inst.dueDate) >= today &&
              new Date(inst.dueDate) < tomorrow,
          );

          for (const installment of dueTodayInstallments) {
            await this.eventPublisher.publish({
              eventType: 'repayment_reminder.due_today',
              aggregateType: 'repayment_schedule',
              aggregateId: schedule.id,
              payload: {
                loanApplicationId: schedule.loanApplicationId,
                userId: schedule.userId,
                dueDate: installment.dueDate,
                amount: installment.totalAmount,
                installmentNumber: installment.installmentNumber,
              },
              userId: String(schedule.userId),
            });
          }
        }

        this.logger.info(`Sent ${schedules.length} payment due today reminders`);
      } catch (error) {
        this.logger.error('Error in payment due today reminders job', { error });
      }
    });

    this.jobs.push(job);
  }

  public stop(): void {
    this.jobs.forEach((job) => job.stop());
    this.logger.info('Repayment reminder cron jobs stopped');
  }
}
