import { LoanApplicationRepository } from './loan-application.repository';
import { ILoanApplication, LoanStatus } from './loan-application.model';
import {
  CreateLoanApplicationDto,
  UpdateLoanApplicationDto,
  ReviewLoanApplicationDto,
} from './dto/loan-application.dto';
import {
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../shared/errors/app-error';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { DistributedLock } from '../../shared/utils/distributed-lock';
import { Types } from 'mongoose';

export class LoanApplicationService {
  private repository: LoanApplicationRepository;
  private eventPublisher: EventPublisher;
  private distributedLock: DistributedLock;

  constructor() {
    this.repository = new LoanApplicationRepository();
    this.eventPublisher = new EventPublisher();
    this.distributedLock = new DistributedLock();
  }

  private getRandomCreditScore(): number {
    return Math.floor(Math.random() * (850 - 300 + 1)) + 300;
  }

  private calculateInterestRate(creditScore: number): number {
    if (creditScore >= 750) {
      return 5;
    } else if (creditScore >= 700) {
      return 7;
    } else if (creditScore >= 650) {
      return 10;
    } else if (creditScore >= 600) {
      return 15;
    } else {
      return 20;
    }
  }

  public async createApplication(
    applicantId: Types.ObjectId,
    dto: CreateLoanApplicationDto,
  ): Promise<ILoanApplication> {
    const creditScore = this.getRandomCreditScore();
    const interestRate = this.calculateInterestRate(creditScore);

    const application = await this.repository.create({
      applicantId,
      ...dto,
      status: LoanStatus.DRAFT,
      interestRate,
      creditScore: creditScore,
      statusHistory: [
        {
          status: LoanStatus.DRAFT,
          changedBy: applicantId,
          changedAt: new Date(),
        },
      ],
    });

    await this.eventPublisher.publish({
      eventType: 'loan_application.created',
      aggregateType: 'loan_application',
      aggregateId: application.id,
      payload: {
        applicantId,
        amount: dto.amount,
        term: dto.term,
      },
      userId: String(applicantId),
    });

    return application;
  }

  public async getApplication(id: string): Promise<ILoanApplication> {
    const application = await this.repository.findById(new Types.ObjectId(id));

    if (!application) {
      throw new NotFoundError('Loan Application');
    }

    return application;
  }

  public async getUserApplications(
    applicantId: Types.ObjectId,
    options: QueryOptions,
  ): Promise<PaginatedResult<ILoanApplication>> {
    return await this.repository.findByApplicantId(applicantId, options);
  }

  public async getAllApplications(
    options: QueryOptions,
  ): Promise<PaginatedResult<ILoanApplication>> {
    return await this.repository.findAll(options);
  }

  public async updateApplication(
    id: string,
    userId: Types.ObjectId,
    dto: UpdateLoanApplicationDto,
  ): Promise<ILoanApplication> {
    const application = await this.repository.findById(new Types.ObjectId(id));

    if (!application) {
      throw new NotFoundError('Loan Application');
    }

    if (application.status !== LoanStatus.DRAFT) {
      throw new UnprocessableEntityError(
        'Can only update applications in draft status',
        'INVALID_STATUS',
      );
    }

    const updated = await this.repository.update(new Types.ObjectId(id), dto);

    if (!updated) {
      throw new NotFoundError('Loan Application');
    }

    await this.eventPublisher.publish({
      eventType: 'loan_application.updated',
      aggregateType: 'loan_application',
      aggregateId: String(id),
      payload: { changes: dto },
      userId: String(userId),
    });

    return updated;
  }

  public async submitApplication(id: string, userId: Types.ObjectId): Promise<ILoanApplication> {
    return await this.distributedLock.executeWithLock(`loan:${id}`, async () => {
      const application = await this.repository.findById(new Types.ObjectId(id));

      if (!application) {
        throw new NotFoundError('Loan Application');
      }

      if (application.status !== LoanStatus.DRAFT) {
        throw new ConflictError('Application already submitted', 'ALREADY_SUBMITTED');
      }

      const updated = await this.repository.updateStatus(
        new Types.ObjectId(id),
        LoanStatus.SUBMITTED,
        userId,
        'Application submitted for review',
      );

      if (!updated) {
        throw new NotFoundError('Loan Application');
      }

      await this.eventPublisher.publish({
        eventType: 'loan_application.submitted',
        aggregateType: 'loan_application',
        aggregateId: String(id),
        payload: {
          amount: updated.amount,
          term: updated.term,
          applicantId: updated.applicantId,
        },
        userId: String(userId),
      });

      return updated;
    });
  }

  public async reviewApplication(
    id: string,
    reviewerId: Types.ObjectId,
    dto: ReviewLoanApplicationDto,
  ): Promise<ILoanApplication> {
    return await this.distributedLock.executeWithLock(`loan:${id}`, async () => {
      const application = await this.repository.findById(new Types.ObjectId(id));

      if (!application) {
        throw new NotFoundError('Loan Application');
      }

      if (
        application.status !== LoanStatus.SUBMITTED &&
        application.status !== LoanStatus.UNDER_REVIEW
      ) {
        throw new UnprocessableEntityError(
          'Invalid application status for review',
          'INVALID_STATUS',
        );
      }

      const newStatus = dto.decision === 'approve' ? LoanStatus.APPROVED : LoanStatus.REJECTED;

      const updateData: Partial<ILoanApplication> = {
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes,
      };

      if (dto.decision === 'approve') {
        updateData.approvedBy = reviewerId;
        updateData.approvedAt = new Date();
      } else {
        updateData.rejectedBy = reviewerId;
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = dto.rejectionReason;
      }

      await this.repository.update(new Types.ObjectId(id), updateData);

      const updated = await this.repository.updateStatus(
        new Types.ObjectId(id),
        newStatus,
        reviewerId,
        dto.decision === 'approve' ? 'Application approved' : dto.rejectionReason,
      );

      if (!updated) {
        throw new NotFoundError('Loan Application');
      }

      await this.eventPublisher.publish({
        eventType:
          dto.decision === 'approve' ? 'loan_application.approved' : 'loan_application.rejected',
        aggregateType: 'loan_application',
        aggregateId: String(id),
        payload: {
          reviewerId,
          decision: dto.decision,
          reason: dto.rejectionReason,
        },
        userId: String(reviewerId),
      });

      return updated;
    });
  }

  public async deleteApplication(id: string, userId: Types.ObjectId): Promise<void> {
    const application = await this.repository.findById(new Types.ObjectId(id));

    if (!application) {
      throw new NotFoundError('Loan Application');
    }

    if (application.status !== LoanStatus.DRAFT) {
      throw new UnprocessableEntityError(
        'Can only delete applications in draft status',
        'INVALID_STATUS',
      );
    }

    await this.repository.delete(new Types.ObjectId(id));

    await this.eventPublisher.publish({
      eventType: 'loan_application.deleted',
      aggregateType: 'loan_application',
      aggregateId: String(id),
      payload: {},
      userId: String(userId),
    });
  }
}
