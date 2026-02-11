import { AuthService } from '../auth.service';
import { UserRepository } from '../../user/user.repository';
import { TokenRepository } from '../../token/token.repository';
import { EventPublisher } from '../../../infrastructure/events/event-publisher';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../../shared/errors/app-error';
import { TokenType } from '../../token/token.model';
import { UserRole } from '../../user/user.model';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

const mockUserId = new Types.ObjectId().toHexString();

jest.mock('../../user/user.repository');
jest.mock('../../token/token.repository');
jest.mock('../../../infrastructure/events/event-publisher');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    password: '$2b$10$hashedPassword',
    phoneNumber: '+2348012345678',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.CUSTOMER,
    permissions: ['loan:create', 'loan:read', 'payment:read'],
    isActive: true,
    emailVerified: false,
    phoneVerified: false,
    failedLoginAttempts: 0,
    refreshTokens: [],
    lockedUntil: null,
    comparePassword: jest.fn(),
  };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    userRepository = new UserRepository() as jest.Mocked<UserRepository>;
    tokenRepository = new TokenRepository() as jest.Mocked<TokenRepository>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    authService = new AuthService();

    (authService as any).userRepository = userRepository;
    (authService as any).tokenRepository = tokenRepository;
    (authService as any).eventPublisher = eventPublisher;

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      phoneNumber: '+2348012345678',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser as any);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await authService.register(registerDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(userRepository.create).toHaveBeenCalled();
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw ConflictError if email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictError);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should create email verification token', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser as any);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      await authService.register(registerDto);

      expect(tokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.anything(),
          type: TokenType.EMAIL_VERIFICATION,
          isUsed: false,
        }),
      );
    });

    it('should publish user.registered event', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser as any);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      await authService.register(registerDto);

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.registered',
          aggregateType: 'auth',
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login successfully with valid credentials', async () => {
      mockUser.comparePassword.mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.resetFailedLoginAttempts.mockResolvedValue(undefined);
      userRepository.updateLastLogin.mockResolvedValue(undefined);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await authService.login(loginDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockUser.comparePassword).toHaveBeenCalledWith(loginDto.password);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedError if user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if password is invalid', async () => {
      mockUser.comparePassword.mockResolvedValue(false);
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.incrementFailedLoginAttempts.mockResolvedValue(undefined);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
      expect(userRepository.incrementFailedLoginAttempts).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedError if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 30 * 60000),
      };
      userRepository.findByEmail.mockResolvedValue(lockedUser as any);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser as any);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should lock account after max failed attempts', async () => {
      const userWithFailedAttempts = { ...mockUser, failedLoginAttempts: 5 };
      mockUser.comparePassword.mockResolvedValue(false);
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.incrementFailedLoginAttempts.mockResolvedValue(undefined);
      userRepository.findById.mockResolvedValue(userWithFailedAttempts as any);
      userRepository.lockAccount.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
      expect(userRepository.lockAccount).toHaveBeenCalled();
    });

    it('should reset failed login attempts on successful login', async () => {
      mockUser.comparePassword.mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.resetFailedLoginAttempts.mockResolvedValue(undefined);
      userRepository.updateLastLogin.mockResolvedValue(undefined);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      await authService.login(loginDto);

      expect(userRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = { email: 'test@example.com' };

    it('should send password reset token if user exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      tokenRepository.invalidateUserTokens.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.forgotPassword(forgotPasswordDto);

      expect(tokenRepository.invalidateUserTokens).toHaveBeenCalledWith(
        mockUser.id,
        TokenType.PASSWORD_RESET,
      );
      expect(tokenRepository.create).toHaveBeenCalled();
    });

    it('should silently return if user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await authService.forgotPassword(forgotPasswordDto);

      expect(tokenRepository.invalidateUserTokens).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto = {
      token: 'reset-token-123',
      newPassword: 'NewPassword123!',
    };

    const mockToken = {
      id: 'token-123',
      userId: { toString: () => mockUser.id } as any,
      token: 'reset-token-123',
      type: TokenType.PASSWORD_RESET,
    };

    it('should reset password with valid token', async () => {
      tokenRepository.findByToken.mockResolvedValue(mockToken as any);
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);
      tokenRepository.markAsUsed.mockResolvedValue(null);
      userRepository.removeAllRefreshTokens.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.resetPassword(resetPasswordDto);

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ password: resetPasswordDto.newPassword }),
      );
      expect(tokenRepository.markAsUsed).toHaveBeenCalledWith(mockToken.id);
    });

    it('should throw UnauthorizedError if token is invalid', async () => {
      tokenRepository.findByToken.mockResolvedValue(null);

      await expect(authService.resetPassword(resetPasswordDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw NotFoundError if user not found', async () => {
      tokenRepository.findByToken.mockResolvedValue(mockToken as any);
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.resetPassword(resetPasswordDto)).rejects.toThrow(NotFoundError);
    });

    it('should invalidate all refresh tokens after password reset', async () => {
      tokenRepository.findByToken.mockResolvedValue(mockToken as any);
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);
      tokenRepository.markAsUsed.mockResolvedValue(null);
      userRepository.removeAllRefreshTokens.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.resetPassword(resetPasswordDto);

      expect(userRepository.removeAllRefreshTokens).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto = { token: 'email-verify-token' };

    const mockToken = {
      id: 'token-123',
      userId: { toString: () => mockUser.id } as any,
      token: 'email-verify-token',
      type: TokenType.EMAIL_VERIFICATION,
    };

    it('should verify email with valid token', async () => {
      tokenRepository.findByToken.mockResolvedValue(mockToken as any);
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue({ ...mockUser, emailVerified: true } as any);
      tokenRepository.markAsUsed.mockResolvedValue(null);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.verifyEmail(verifyEmailDto);

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ emailVerified: true }),
      );
    });

    it('should throw UnauthorizedError if token is invalid', async () => {
      tokenRepository.findByToken.mockResolvedValue(null);

      await expect(authService.verifyEmail(verifyEmailDto)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifyPhone', () => {
    const verifyPhoneDto = { token: '123456' };

    const mockToken = {
      id: 'token-123',
      userId: { toString: () => mockUser.id } as any,
      token: '123456',
      type: TokenType.PHONE_VERIFICATION,
    };

    it('should verify phone with valid token', async () => {
      tokenRepository.findByToken.mockResolvedValue(mockToken as any);
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue({ ...mockUser, phoneVerified: true } as any);
      tokenRepository.markAsUsed.mockResolvedValue(null);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.verifyPhone(verifyPhoneDto);

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ phoneVerified: true }),
      );
    });

    it('should throw UnauthorizedError if token is invalid', async () => {
      tokenRepository.findByToken.mockResolvedValue(null);

      await expect(authService.verifyPhone(verifyPhoneDto)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('requestVerification', () => {
    it('should request email verification', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      userRepository.findById.mockResolvedValue(unverifiedUser as any);
      tokenRepository.invalidateUserTokens.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.requestVerification(mockUser.id, { type: 'email' });

      expect(tokenRepository.invalidateUserTokens).toHaveBeenCalledWith(
        mockUser.id,
        TokenType.EMAIL_VERIFICATION,
      );
      expect(tokenRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if email already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      userRepository.findById.mockResolvedValue(verifiedUser as any);

      await expect(authService.requestVerification(mockUser.id, { type: 'email' })).rejects.toThrow(
        ConflictError,
      );
    });

    it('should request phone verification', async () => {
      const unverifiedUser = { ...mockUser, phoneVerified: false };
      userRepository.findById.mockResolvedValue(unverifiedUser as any);
      tokenRepository.invalidateUserTokens.mockResolvedValue(undefined);
      tokenRepository.create.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.requestVerification(mockUser.id, { type: 'phone' });

      expect(tokenRepository.invalidateUserTokens).toHaveBeenCalledWith(
        mockUser.id,
        TokenType.PHONE_VERIFICATION,
      );
    });

    it('should throw ConflictError if phone already verified', async () => {
      const verifiedUser = { ...mockUser, phoneVerified: true };
      userRepository.findById.mockResolvedValue(verifiedUser as any);

      await expect(authService.requestVerification(mockUser.id, { type: 'phone' })).rejects.toThrow(
        ConflictError,
      );
    });

    it('should throw ConflictError if no phone number exists', async () => {
      const userWithoutPhone = { ...mockUser, phoneNumber: undefined };
      userRepository.findById.mockResolvedValue(userWithoutPhone as any);

      await expect(authService.requestVerification(mockUser.id, { type: 'phone' })).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';

    it('should generate new tokens with valid refresh token', async () => {
      const decoded = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        permissions: mockUser.permissions,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      userRepository.findById.mockResolvedValue({
        ...mockUser,
        refreshTokens: [refreshToken],
      } as any);
      userRepository.removeRefreshToken.mockResolvedValue(undefined);
      userRepository.addRefreshToken.mockResolvedValue(undefined);
      (jwt.sign as jest.Mock).mockReturnValue('new-token');

      const result = await authService.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedError if token is invalid', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if token is expired', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user not found', async () => {
      const decoded = { userId: 'non-existent', email: '', role: '', permissions: [] };
      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if refresh token not in user list', async () => {
      const decoded = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        permissions: mockUser.permissions,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      userRepository.findById.mockResolvedValue({ ...mockUser, refreshTokens: [] } as any);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('logout', () => {
    it('should remove refresh token and publish event', async () => {
      userRepository.removeRefreshToken.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.logout(mockUser.id, 'refresh-token');

      expect(userRepository.removeRefreshToken).toHaveBeenCalledWith(mockUser.id, 'refresh-token');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.logged_out',
        }),
      );
    });
  });

  describe('logoutAll', () => {
    it('should remove all refresh tokens and publish event', async () => {
      userRepository.removeAllRefreshTokens.mockResolvedValue(undefined);
      eventPublisher.publish.mockResolvedValue(undefined);

      await authService.logoutAll(mockUser.id);

      expect(userRepository.removeAllRefreshTokens).toHaveBeenCalledWith(mockUser.id);
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.logged_out_all',
        }),
      );
    });
  });
});
