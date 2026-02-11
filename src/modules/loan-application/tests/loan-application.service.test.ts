import { LoanApplicationService } from '../loan-application.service';
import { LoanApplicationRepository } from '../loan-application.repository';
import { CustomerRepository } from '../../customer/customer.repository';
import { EventPublisher } from '../../../infrastructure/events/event-publisher';
import { DistributedLock } from '../../../shared/utils/distributed-lock';
import {
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../shared/errors/app-error';
import { LoanStatus } from '../loan-application.model';
import { Types } from 'mongoose';

jest.mock('../loan-application.repository');
jest.mock('../../customer/customer.repository');
jest.mock('../../../infrastructure/events/event-publisher');
jest.mock('../../../shared/utils/distributed-lock');
jest.mock('../../user/user.service');

describe('LoanApplicationService', () => {
  let service: LoanApplicationService;
  let repository: jest.Mocked<LoanApplicationRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let eventPublisher: jest.Mocked<EventPublisher>;
  let distributedLock: jest.Mocked<DistributedLock>;

  const applicantId = new Types.ObjectId();
  const loanId = new Types.ObjectId();
  const reviewerId = new Types.ObjectId();

  const mockCustomer = {
    id: 'customer-123',
    userId: applicantId,
    isVerified: true,
    personalInformation: {
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  const mockLoanApplication = {
    id: loanId.toString(),
    _id: loanId,
    applicantId,
    amount: 50000,
    term: 24,
    interestRate: 12,
    status: LoanStatus.DRAFT,
    creditScore: 720,
    debtToIncomeRatio: 30,
    statusHistory: [
      {
        status: LoanStatus.DRAFT,
        changedBy: applicantId,
        changedAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    repository = new LoanApplicationRepository() as jest.Mocked<LoanApplicationRepository>;
    customerRepository = new CustomerRepository() as jest.Mocked<CustomerRepository>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    distributedLock = new DistributedLock() as jest.Mocked<DistributedLock>;

    service = new LoanApplicationService();
    (service as any).repository = repository;
    (service as any).customerRepository = customerRepository;
    (service as any).eventPublisher = eventPublisher;
    (service as any).distributedLock = distributedLock;

    jest.clearAllMocks();
  });

  describe('createApplication', () => {
    const createDto = {
      amount: 50000,
      purpose: 'Business expansion',
      term: 24,
    };

    it('should create loan application successfully', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(mockCustomer as any);
      repository.findByApplicantId.mockResolvedValue({ data: [], meta: {} } as any);
      repository.create.mockResolvedValue(mockLoanApplication as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.createApplication(applicantId, createDto as any);

      expect(customerRepository.findCustomerByUserId).toHaveBeenCalledWith(String(applicantId));
      expect(repository.create).toHaveBeenCalled();
      expect(result.status).toBe(LoanStatus.DRAFT);
      expect(result.creditScore).toBeDefined();
    });

    it('should throw NotFoundError if customer not found', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(null);

      await expect(service.createApplication(applicantId, createDto as any)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw UnprocessableEntityError if customer not verified', async () => {
      const unverifiedCustomer = { ...mockCustomer, isVerified: false };
      customerRepository.findCustomerByUserId.mockResolvedValue(unverifiedCustomer as any);

      await expect(service.createApplication(applicantId, createDto as any)).rejects.toThrow(
        UnprocessableEntityError,
      );
    });

    it('should throw ConflictError if active application exists', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(mockCustomer as any);
      repository.findByApplicantId.mockResolvedValue({
        data: [{ status: LoanStatus.SUBMITTED }],
        meta: {},
      } as any);

      await expect(service.createApplication(applicantId, createDto as any)).rejects.toThrow(
        ConflictError,
      );
    });

    it('should generate random credit score between 500 and 850', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(mockCustomer as any);
      repository.findByApplicantId.mockResolvedValue({ data: [], meta: {} } as any);
      repository.create.mockResolvedValue(mockLoanApplication as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.createApplication(applicantId, createDto as any);

      expect(result.creditScore).toBeGreaterThanOrEqual(500);
      expect(result.creditScore).toBeLessThanOrEqual(850);
    });

    it('should calculate interest rate based on credit score', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(mockCustomer as any);
      repository.findByApplicantId.mockResolvedValue({ data: [], meta: {} } as any);

      const highCreditApp = { ...mockLoanApplication, creditScore: 760 };
      repository.create.mockResolvedValue(highCreditApp as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.createApplication(applicantId, createDto as any);

      expect(result.interestRate).toBeDefined();
    });

    it('should publish loan_application.created event', async () => {
      customerRepository.findCustomerByUserId.mockResolvedValue(mockCustomer as any);
      repository.findByApplicantId.mockResolvedValue({ data: [], meta: {} } as any);
      repository.create.mockResolvedValue(mockLoanApplication as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.createApplication(applicantId, createDto as any);

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'loan_application.created',
          aggregateType: 'loan_application',
        }),
      );
    });
  });

  describe('getApplication', () => {
    it('should return loan application by id', async () => {
      repository.findById.mockResolvedValue(mockLoanApplication as any);

      const result = await service.getApplication(loanId.toString());

      expect(repository.findById).toHaveBeenCalledWith(loanId);
      expect(result).toEqual(mockLoanApplication);
    });

    it('should throw NotFoundError if application not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getApplication(loanId.toString())).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserApplications', () => {
    it('should return paginated user applications', async () => {
      const paginatedResult = {
        data: [mockLoanApplication],
        meta: { total: 1, page: 1, limit: 10 },
      };
      repository.findByApplicantId.mockResolvedValue(paginatedResult as any);

      const result = await service.getUserApplications(applicantId, {});

      expect(repository.findByApplicantId).toHaveBeenCalledWith(applicantId, {});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getAllApplications', () => {
    it('should return all paginated applications', async () => {
      const paginatedResult = {
        data: [mockLoanApplication],
        meta: { total: 1, page: 1, limit: 10 },
      };
      repository.findAll.mockResolvedValue(paginatedResult as any);

      const result = await service.getAllApplications({});

      expect(repository.findAll).toHaveBeenCalledWith({});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateApplication', () => {
    const updateDto = { amount: 60000, purpose: 'Updated purpose' };

    it('should update draft application successfully', async () => {
      repository.findById.mockResolvedValue(mockLoanApplication as any);
      repository.update.mockResolvedValue({ ...mockLoanApplication, ...updateDto } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.updateApplication(loanId.toString(), applicantId, updateDto as any);

      expect(repository.update).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundError if application not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateApplication(loanId.toString(), applicantId, updateDto as any),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw UnprocessableEntityError if not in draft status', async () => {
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);

      await expect(
        service.updateApplication(loanId.toString(), applicantId, updateDto as any),
      ).rejects.toThrow(UnprocessableEntityError);
    });
  });

  describe('submitApplication', () => {
    it('should submit draft application successfully', async () => {
      const userService = require('../../user/user.service');
      userService.userService = {
        getUserById: jest.fn().mockResolvedValue({
          email: 'user@test.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      };

      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      repository.findById.mockResolvedValue(mockLoanApplication as any);
      repository.updateStatus.mockResolvedValue({
        ...mockLoanApplication,
        status: LoanStatus.SUBMITTED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.submitApplication(loanId.toString(), applicantId);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        loanId,
        LoanStatus.SUBMITTED,
        applicantId,
        'Application submitted for review',
      );
      expect(result.status).toBe(LoanStatus.SUBMITTED);
    });

    it('should throw NotFoundError if application not found', async () => {
      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      repository.findById.mockResolvedValue(null);

      await expect(service.submitApplication(loanId.toString(), applicantId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ConflictError if already submitted', async () => {
      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);

      await expect(service.submitApplication(loanId.toString(), applicantId)).rejects.toThrow(
        ConflictError,
      );
    });

    it('should use distributed lock', async () => {
      const userService = require('../../user/user.service');
      userService.userService = {
        getUserById: jest.fn().mockResolvedValue({
          email: 'user@test.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      };

      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      repository.findById.mockResolvedValue(mockLoanApplication as any);
      repository.updateStatus.mockResolvedValue({
        ...mockLoanApplication,
        status: LoanStatus.SUBMITTED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.submitApplication(loanId.toString(), applicantId);

      expect(distributedLock.executeWithLock).toHaveBeenCalledWith(
        `loan:${loanId}`,
        expect.any(Function),
      );
    });
  });

  describe('reviewApplication', () => {
    const reviewDto = {
      decision: 'approve' as const,
      reviewNotes: 'Application meets all criteria',
    };

    it('should approve application successfully', async () => {
      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);
      repository.update.mockResolvedValue(submittedLoan as any);
      repository.updateStatus.mockResolvedValue({
        ...submittedLoan,
        status: LoanStatus.APPROVED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.reviewApplication(loanId.toString(), reviewerId, reviewDto);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        loanId,
        LoanStatus.APPROVED,
        reviewerId,
        'Application approved',
      );
      expect(result.status).toBe(LoanStatus.APPROVED);
    });

    it('should reject application successfully', async () => {
      const rejectDto = {
        decision: 'reject' as const,
        reviewNotes: 'Insufficient credit',
        rejectionReason: 'Low credit score',
      };

      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);
      repository.update.mockResolvedValue(submittedLoan as any);
      repository.updateStatus.mockResolvedValue({
        ...submittedLoan,
        status: LoanStatus.REJECTED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.reviewApplication(loanId.toString(), reviewerId, rejectDto);

      expect(result.status).toBe(LoanStatus.REJECTED);
    });

    it('should throw UnprocessableEntityError if invalid status', async () => {
      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const approvedLoan = { ...mockLoanApplication, status: LoanStatus.APPROVED };
      repository.findById.mockResolvedValue(approvedLoan as any);

      await expect(
        service.reviewApplication(loanId.toString(), reviewerId, reviewDto),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should publish correct event for approval', async () => {
      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);
      repository.update.mockResolvedValue(submittedLoan as any);
      repository.updateStatus.mockResolvedValue({
        ...submittedLoan,
        status: LoanStatus.APPROVED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.reviewApplication(loanId.toString(), reviewerId, reviewDto);

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'loan_application.approved',
        }),
      );
    });

    it('should publish correct event for rejection', async () => {
      const rejectDto = {
        decision: 'reject' as const,
        reviewNotes: 'Insufficient credit',
        rejectionReason: 'Low credit score',
      };

      distributedLock.executeWithLock.mockImplementation(async (_, callback) => callback());
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);
      repository.update.mockResolvedValue(submittedLoan as any);
      repository.updateStatus.mockResolvedValue({
        ...submittedLoan,
        status: LoanStatus.REJECTED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.reviewApplication(loanId.toString(), reviewerId, rejectDto);

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'loan_application.rejected',
        }),
      );
    });
  });

  describe('deleteApplication', () => {
    it('should delete draft application successfully', async () => {
      repository.findById.mockResolvedValue(mockLoanApplication as any);
      repository.delete.mockResolvedValue(true);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.deleteApplication(loanId.toString(), applicantId);

      expect(repository.delete).toHaveBeenCalledWith(loanId);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundError if application not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deleteApplication(loanId.toString(), applicantId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw UnprocessableEntityError if not draft status', async () => {
      const submittedLoan = { ...mockLoanApplication, status: LoanStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedLoan as any);

      await expect(service.deleteApplication(loanId.toString(), applicantId)).rejects.toThrow(
        UnprocessableEntityError,
      );
    });
  });
});
