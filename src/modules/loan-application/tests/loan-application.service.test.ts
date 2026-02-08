import { LoanApplicationService } from '../loan-application.service';
import { LoanStatus } from '../loan-application.model';
import { NotFoundError, UnprocessableEntityError } from '../../../shared/errors/app-error';

describe('LoanApplicationService', () => {
  let service: LoanApplicationService;

  beforeEach(() => {
    service = new LoanApplicationService();
  });

  describe('createApplication', () => {
    it('should create a loan application in draft status', async () => {
      const dto = {
        amount: 50000,
        purpose: 'Business expansion',
        term: 24,
        interestRate: 12.5,
      };

      const result = await service.createApplication('user-id', dto);

      expect(result.status).toBe(LoanStatus.DRAFT);
      expect(result.amount).toBe(dto.amount);
      expect(result.applicantId).toBe('user-id');
    });
  });

  describe('submitApplication', () => {
    it('should submit a draft application', async () => {
      const application = await service.createApplication('user-id', {
        amount: 50000,
        purpose: 'Business',
        term: 24,
        interestRate: 12.5,
      });

      const result = await service.submitApplication(application.id, 'user-id');

      expect(result.status).toBe(LoanStatus.SUBMITTED);
    });

    it('should throw error if application is not in draft status', async () => {
      const application = await service.createApplication('user-id', {
        amount: 50000,
        purpose: 'Business',
        term: 24,
        interestRate: 12.5,
      });

      await service.submitApplication(application.id, 'user-id');

      await expect(
        service.submitApplication(application.id, 'user-id')
      ).rejects.toThrow(UnprocessableEntityError);
    });
  });
});
