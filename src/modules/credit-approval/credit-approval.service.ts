import { CreditApprovalRepository } from './credit-approval.repository';
import { ICreditApproval } from './credit-approval.model';
import { CreateCreditApprovalDto } from './dto/credit-approval.dto';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { LoanApplicationRepository } from '../loan-application/loan-application.repository';
import { Types } from 'mongoose';

export class CreditApprovalService {
  private repository: CreditApprovalRepository;
  private loanRepository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;

  constructor() {
    this.repository = new CreditApprovalRepository();
    this.loanRepository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
  }

  public async createApproval(
    reviewerId: Types.ObjectId,
    dto: CreateCreditApprovalDto,
  ): Promise<ICreditApproval> {
    const loan = await this.loanRepository.findById(dto.loanApplicationId);

    if (!loan) {
      throw new NotFoundError('Loan Application');
    }

    const existing = await this.repository.findByLoanApplicationId(dto.loanApplicationId);

    if (existing) {
      throw new ConflictError('Credit approval already exists for this loan');
    }

    const approval = await this.repository.create({
      ...dto,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });

    await this.eventPublisher.publish({
      eventType: 'credit_approval.created',
      aggregateType: 'credit_approval',
      aggregateId: approval.id,
      payload: {
        loanApplicationId: dto.loanApplicationId,
        decision: dto.decision,
        creditScore: dto.creditScore,
      },
      userId: String(reviewerId),
    });

    return approval;
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
}
