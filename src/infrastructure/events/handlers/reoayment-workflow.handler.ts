import { RepaymentScheduleService } from '@/modules/repayment-schedule/repayment-schedule.service';
import { Types } from 'mongoose';
import { EventSubscriber } from '../event-subscriber';
import { DomainEvent } from '../event-publisher';

export class RepaymentScheduleEventHandlers {
  private repaymentScheduleService: RepaymentScheduleService;
  private eventSubscriber: EventSubscriber;

  constructor() {
    this.repaymentScheduleService = new RepaymentScheduleService();
    this.eventSubscriber = new EventSubscriber();
  }

  public async initialize(): Promise<void> {
    await this.eventSubscriber.subscribe(
      'repayment-schedule-handler',
      ['disbursement.disbursement.completed'],
      this.handleEvent.bind(this),
    );

    console.log('Repayment schedule event handlers initialized');
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    if (event.eventType === 'disbursement.completed') {
      await this.handleDisbursementCompleted(event);
    }
  }

  private async handleDisbursementCompleted(event: DomainEvent): Promise<void> {
    try {
      const disbursementId = new Types.ObjectId(event.aggregateId);

      console.log(`Generating repayment schedule for disbursement: ${disbursementId}`);

      const schedule =
        await this.repaymentScheduleService.generateScheduleFromDisbursement(disbursementId);

      console.log(
        `Repayment schedule created: ${schedule.id}, Installments: ${schedule.summary.numberOfInstallments}`,
      );
    } catch (error) {
      console.error(
        `Failed to generate repayment schedule for disbursement: ${event.aggregateId}`,
        error,
      );
    }
  }
}

export async function initializeRepaymentScheduleWorkflow(): Promise<RepaymentScheduleEventHandlers> {
  const handlers = new RepaymentScheduleEventHandlers();
  await handlers.initialize();
  return handlers;
}
