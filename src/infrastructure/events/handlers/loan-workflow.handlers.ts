import { CreditApprovalService } from '@/modules/credit-approval/credit-approval.service';
import { DisbursementService } from '@/modules/disbursement/disbursement.service';
import { Types } from 'mongoose';
import { DomainEvent } from '../event-publisher';
import { EventSubscriber } from '../event-subscriber';

export class LoanWorkflowEventHandlers {
  private creditApprovalService: CreditApprovalService;
  private disbursementService: DisbursementService;
  private eventSubscriber: EventSubscriber;

  constructor() {
    this.creditApprovalService = new CreditApprovalService();
    this.disbursementService = new DisbursementService();
    this.eventSubscriber = new EventSubscriber();
  }

  public async initialize(): Promise<void> {
    await this.eventSubscriber.subscribe(
      'loan-workflow-handler',
      [
        'loan_application.loan_application.submitted',
        'loan_application.loan_application.approved',
        'credit_approval.credit_approval.created',
        'disbursement.disbursement.completed',
        'disbursement.disbursement.failed',
      ],
      this.handleEvent.bind(this),
    );

    console.log('Loan workflow event handlers initialized');
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'loan_application.submitted':
        await this.handleLoanSubmitted(event);
        break;
      case 'loan_application.approved':
        await this.handleLoanApproved(event);
        break;
      case 'credit_approval.created':
        await this.handleCreditApprovalCreated(event);
        break;
      case 'disbursement.completed':
        await this.handleDisbursementCompleted(event);
        break;
      case 'disbursement.failed':
        await this.handleDisbursementFailed(event);
        break;
    }
  }

  private async handleLoanSubmitted(event: DomainEvent): Promise<void> {
    try {
      const loanApplicationId = new Types.ObjectId(event.aggregateId);

      console.log(`Processing automated credit approval for loan: ${loanApplicationId}`);

      const approval = await this.creditApprovalService.processAutomatedApproval(loanApplicationId);

      console.log(
        `Automated credit approval completed for loan: ${loanApplicationId}, Decision: ${approval.decision}`,
      );
    } catch (error) {
      console.error(
        `Failed to process automated credit approval for loan: ${event.aggregateId}`,
        error,
      );
    }
  }

  private async handleLoanApproved(event: DomainEvent): Promise<void> {
    try {
      const loanApplicationId = new Types.ObjectId(event.aggregateId);

      console.log(`Processing automated disbursement for loan: ${loanApplicationId}`);

      const disbursement =
        await this.disbursementService.processAutomatedDisbursement(loanApplicationId);

      console.log(
        `Automated disbursement initiated for loan: ${loanApplicationId}, Disbursement ID: ${disbursement.id}`,
      );
    } catch (error) {
      console.error(
        `Failed to process automated disbursement for loan: ${event.aggregateId}`,
        error,
      );
    }
  }

  private async handleCreditApprovalCreated(event: DomainEvent): Promise<void> {
    try {
      const { loanApplicationId, decision, automated } = event.payload;

      console.log(
        `Credit approval created for loan: ${loanApplicationId}, Decision: ${decision}, Automated: ${automated}`,
      );
    } catch (error) {
      console.error('Failed to handle credit approval event', error);
    }
  }

  private async handleDisbursementCompleted(event: DomainEvent): Promise<void> {
    try {
      const { loanApplicationId, transactionReference, amount } = event.payload;

      console.log(
        `Disbursement completed for loan: ${loanApplicationId}, Amount: ${amount}, Ref: ${transactionReference}`,
      );
    } catch (error) {
      console.error('Failed to handle disbursement completion event', error);
    }
  }

  private async handleDisbursementFailed(event: DomainEvent): Promise<void> {
    try {
      const { loanApplicationId, error } = event.payload;

      console.error(`Disbursement failed for loan: ${loanApplicationId}, Error: ${error}`);
    } catch (err) {
      console.error('Failed to handle disbursement failure event', err);
    }
  }
}

export async function initializeLoanWorkflow(): Promise<LoanWorkflowEventHandlers> {
  const handlers = new LoanWorkflowEventHandlers();
  await handlers.initialize();
  return handlers;
}
