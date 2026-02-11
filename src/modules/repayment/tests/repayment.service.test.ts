import { RepaymentService } from '../repayment.service';
import { RepaymentRepository } from '../repayment.repository';
import { LoanApplicationRepository } from '../../loan-application/loan-application.repository';
import { RepaymentScheduleService } from '../../repayment-schedule/repayment-schedule.service';
import { EventPublisher } from '../../../infrastructure/events/event-publisher';
import { DistributedLock } from '../../../shared/utils/distributed-lock';
import { NotFoundError, UnprocessableEntityError } from '../../../shared/errors/app-error';
import { PaymentStatus } from '../repayment.model';
import { LoanStatus } from '../../loan-application/loan-application.model';
import { Types } from 'mongoose';

jest.mock('../repayment.repository');
jest.mock('../loan-application/loan-application.repository');
jest.mock('../repayment-schedule/repayment-schedule.service');
jest.mock('../../../infrastructure/events/event-publisher');
jest.mock('../../../shared/utils/distributed-lock');

describe('RepaymentService', () => {
  let service: RepaymentService;
  let repository: jest.Mocked<RepaymentRepository>;
  let loanRepository: jest.Mocked<LoanApplicationRepository>;
  let scheduleService: jest.Mocked<RepaymentScheduleService>;
  let eventPublisher: jest.Mocked<EventPublisher>;
  let distributedLock: jest.Mocked<DistributedLock>;

  const userId = new Types.ObjectId();
  const loanId = new Types.ObjectId();
  const repaymentId = new Types.ObjectId().toString();

  const mockLoan = {
    _id: loanId,
    id: loanId.toString(),
    status: LoanStatus.DISBURSED,
    applicantId: new Types.ObjectId(),
    amount: 100000,
    term: 24,
  };

  const mockSchedule = {
    id: 'schedule-001',
    loanApplicationId: loanId.toString(),
    installments: [
      {
        installmentNumber: 1,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        principalAmount: 4000,
        interestAmount: 1000,
        totalAmount: 5000,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        principalAmount: 4100,
        interestAmount: 900,
        totalAmount: 5000,
        status: 'pending',
      },
    ],
  };

  const mockRepayment = {
    id: repaymentId,
    _id: new Types.ObjectId(repaymentId),
    loanApplicationId: loanId.toString(),
    amount: 5000,
    principalAmount: 4000,
    interestAmount: 1000,
    dueDate: new Date(),
    paidDate: new Date(),
    status: PaymentStatus.COMPLETED,
    transactionReference: 'TXN-12345',
    paidBy: userId.toString(),
  };

  beforeEach(() => {
    repository = new RepaymentRepository() as jest.Mocked<RepaymentRepository>;
    loanRepository = new LoanApplicationRepository() as jest.Mocked<LoanApplicationRepository>;
    scheduleService = new RepaymentScheduleService() as jest.Mocked<RepaymentScheduleService>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    distributedLock = new DistributedLock() as jest.Mocked<DistributedLock>;

    service = new RepaymentService();
    (service as any).repository = repository;
    (service as any).loanRepository = loanRepository;
    (service as any).repaymentScheduleService = scheduleService;
    (service as any).eventPublisher = eventPublisher;
    (service as any).distributedLock = distributedLock;

    jest.clearAllMocks();
    distributedLock.executeWithLock.mockImplementation(async (_, fn) => fn());
  });

  describe('processPayment', () => {
    const paymentDto = {
      loanApplicationId: loanId.toString(),
      amount: 5000,
      transactionReference: 'TXN-98765',
      notes: 'Monthly installment',
    };

    it('should process payment successfully', async () => {
      loanRepository.findById.mockResolvedValue(mockLoan as any);
      scheduleService.getScheduleByLoanId.mockResolvedValue(mockSchedule as any);
      repository.create.mockResolvedValue(mockRepayment as any);
      scheduleService.recordPayment.mockResolvedValue({
        ...mockSchedule,
        installments: [{ ...mockSchedule.installments[0], status: 'paid' }],
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.processPayment(userId, paymentDto);

      expect(loanRepository.findById).toHaveBeenCalledWith(loanId);
      expect(repository.create).toHaveBeenCalled();
      expect(scheduleService.recordPayment).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repayment.completed',
        }),
      );
      expect(result.repayment.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should throw NotFoundError when loan not found', async () => {
      loanRepository.findById.mockResolvedValue(null);

      await expect(service.processPayment(userId, paymentDto)).rejects.toThrow(NotFoundError);
    });

    it('should throw UnprocessableEntityError when loan is not disbursed', async () => {
      loanRepository.findById.mockResolvedValue({
        ...mockLoan,
        status: LoanStatus.APPROVED,
      } as any);

      await expect(service.processPayment(userId, paymentDto)).rejects.toThrow(
        UnprocessableEntityError,
      );
    });

    it('should throw NotFoundError when schedule not found', async () => {
      loanRepository.findById.mockResolvedValue(mockLoan as any);
      scheduleService.getScheduleByLoanId.mockResolvedValue(null as any);

      await expect(service.processPayment(userId, paymentDto)).rejects.toThrow(NotFoundError);
    });

    it('should throw UnprocessableEntityError when no pending installments', async () => {
      loanRepository.findById.mockResolvedValue(mockLoan as any);
      scheduleService.getScheduleByLoanId.mockResolvedValue({
        ...mockSchedule,
        installments: [{ ...mockSchedule.installments[0], status: 'paid' }],
      } as any);

      await expect(service.processPayment(userId, paymentDto)).rejects.toThrow(
        UnprocessableEntityError,
      );
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      repository.findById.mockResolvedValue(mockRepayment as any);
      repository.update.mockResolvedValue({
        ...mockRepayment,
        status: PaymentStatus.REFUNDED,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.processRefund(repaymentId, userId, 'Customer overpaid');

      expect(repository.update).toHaveBeenCalledWith(
        repaymentId,
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repayment.refunded',
        }),
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should throw NotFoundError when repayment not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.processRefund(repaymentId, userId, 'Test')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw UnprocessableEntityError when status is not COMPLETED', async () => {
      repository.findById.mockResolvedValue({
        ...mockRepayment,
        status: PaymentStatus.PENDING,
      } as any);

      await expect(service.processRefund(repaymentId, userId, 'Test')).rejects.toThrow(
        UnprocessableEntityError,
      );
    });
  });

  describe('createRepayment', () => {
    const createDto = {
      loanApplicationId: loanId.toString(),
      amount: 5000,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    it('should create pending repayment', async () => {
      loanRepository.findById.mockResolvedValue(mockLoan as any);
      repository.create.mockResolvedValue({
        ...mockRepayment,
        status: PaymentStatus.PENDING,
      } as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.createRepayment(userId.toString(), createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PENDING,
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repayment.created',
        }),
      );
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should throw NotFoundError when loan not found', async () => {
      loanRepository.findById.mockResolvedValue(null);

      await expect(service.createRepayment(userId.toString(), createDto)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getRepayment', () => {
    it('should return repayment by id', async () => {
      repository.findById.mockResolvedValue(mockRepayment as any);

      const result = await service.getRepayment(repaymentId);

      expect(result).toEqual(mockRepayment);
    });

    it('should throw NotFoundError when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getRepayment(repaymentId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getLoanRepayments', () => {
    it('should return paginated repayments for loan', async () => {
      const paginated = {
        data: [mockRepayment],
        meta: { total: 1, page: 1, limit: 10 },
      };
      repository.findByLoanApplicationId.mockResolvedValue(paginated as any);

      const result = await service.getLoanRepayments(loanId.toString(), {});

      expect(result.data).toHaveLength(1);
      expect(repository.findByLoanApplicationId).toHaveBeenCalledWith(loanId.toString(), {});
    });
  });

  describe('getOverdueRepayments', () => {
    it('should delegate to schedule service', async () => {
      const overdue = [{ id: 'sched-1', overdueDays: 5 }];
      scheduleService.getOverdueSchedules.mockResolvedValue(overdue as any);

      const result = await service.getOverdueRepayments();

      expect(scheduleService.getOverdueSchedules).toHaveBeenCalled();
      expect(result).toEqual(overdue);
    });
  });

  describe('getUpcomingRepayments', () => {
    it('should delegate to schedule service with correct days', async () => {
      const upcoming = [{ id: 'sched-2', dueDate: new Date() }];
      scheduleService.getUpcomingPayments.mockResolvedValue(upcoming as any);

      const result = await service.getUpcomingRepayments(7);

      expect(scheduleService.getUpcomingPayments).toHaveBeenCalledWith(7);
      expect(result).toEqual(upcoming);
    });
  });
});
