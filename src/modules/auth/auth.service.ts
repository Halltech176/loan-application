import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository } from '../user/user.repository';
import { TokenRepository } from '../token/token.repository';
import { TokenType } from '../token/token.model';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  RequestVerificationDto,
} from './dto/auth.dto';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { Logger } from '../../infrastructure/logging/logger';
import { Types } from 'mongoose';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    phoneNumber?: string;
    role: string;
    permissions: string[];
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  tokens: TokenPair;
}

export class AuthService {
  private userRepository: UserRepository;
  private tokenRepository: TokenRepository;
  private eventPublisher: EventPublisher;
  private logger: Logger;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;
  private readonly PASSWORD_RESET_EXPIRY_HOURS = 1;
  private readonly EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
  private readonly PHONE_VERIFICATION_EXPIRY_MINUTES = 10;

  constructor() {
    this.userRepository = new UserRepository();
    this.tokenRepository = new TokenRepository();
    this.eventPublisher = new EventPublisher();
    this.logger = Logger.getInstance();
  }

  public async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const user = await this.userRepository.create({
      email: dto.email.toLowerCase(),
      password: dto.password,
      phoneNumber: dto.phoneNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'applicant',
      permissions: this.getPermissionsForRole('applicant'),
      emailVerified: false,
      phoneVerified: false,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

    await this.userRepository.addRefreshToken(user.id, tokens.refreshToken);

    const verificationToken = await this.createVerificationToken(
      user.id,
      TokenType.EMAIL_VERIFICATION,
      this.EMAIL_VERIFICATION_EXPIRY_HOURS,
    );

    await this.eventPublisher.publish({
      eventType: 'user.registered',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        verificationToken,
      },
      userId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified || false,
        phoneVerified: user.phoneVerified || false,
      },
      tokens,
    };
  }

  public async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedError(`Account locked. Try again in ${remainingMinutes} minutes`);
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    const isPasswordValid = await user.comparePassword(dto.password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);

      this.logger.security('Failed login attempt', {
        userId: user.id,
        email: user.email,
      });

      throw new UnauthorizedError('Invalid credentials');
    }

    await this.userRepository.resetFailedLoginAttempts(user.id);
    await this.userRepository.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

    await this.userRepository.addRefreshToken(user.id, tokens.refreshToken);

    await this.eventPublisher.publish({
      eventType: 'user.logged_in',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
      },
      userId: user.id,
    });

    this.logger.security('Successful login', {
      userId: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified || false,
        phoneVerified: user.phoneVerified || false,
      },
      tokens,
    };
  }

  public async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      return;
    }

    await this.tokenRepository.invalidateUserTokens(user.id, TokenType.PASSWORD_RESET);

    const resetToken = await this.createVerificationToken(
      user.id,
      TokenType.PASSWORD_RESET,
      this.PASSWORD_RESET_EXPIRY_HOURS,
      true,
    );

    await this.eventPublisher.publish({
      eventType: 'user.password_reset_requested',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        firstName: user.firstName,
        resetToken,
      },
      userId: user.id,
    });

    this.logger.security('Password reset requested', {
      userId: user.id,
      email: user.email,
    });
  }

  public async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenDoc = await this.tokenRepository.findByToken(dto.token, TokenType.PASSWORD_RESET);

    if (!tokenDoc) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = await this.userRepository.findById(tokenDoc.userId.toString());

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.userRepository.update(user.id, { password: dto.newPassword });

    await this.tokenRepository.markAsUsed(tokenDoc.id);

    await this.userRepository.removeAllRefreshTokens(user.id);

    await this.eventPublisher.publish({
      eventType: 'user.password_reset_completed',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        firstName: user.firstName,
      },
      userId: user.id,
    });

    this.logger.security('Password reset completed', {
      userId: user.id,
      email: user.email,
    });
  }

  public async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const tokenDoc = await this.tokenRepository.findByToken(
      dto.token,
      TokenType.EMAIL_VERIFICATION,
    );

    if (!tokenDoc) {
      throw new UnauthorizedError('Invalid or expired verification token');
    }

    const user = await this.userRepository.findById(tokenDoc.userId.toString());

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.userRepository.update(user.id, { emailVerified: true });

    await this.tokenRepository.markAsUsed(tokenDoc.id);

    await this.eventPublisher.publish({
      eventType: 'user.email_verified',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        firstName: user.firstName,
      },
      userId: user.id,
    });

    this.logger.info('Email verified', {
      userId: user.id,
      email: user.email,
    });
  }

  public async verifyPhone(dto: VerifyPhoneDto): Promise<void> {
    const tokenDoc = await this.tokenRepository.findByToken(
      dto.token,
      TokenType.PHONE_VERIFICATION,
    );

    if (!tokenDoc) {
      throw new UnauthorizedError('Invalid or expired verification code');
    }

    const user = await this.userRepository.findById(tokenDoc.userId.toString());

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.userRepository.update(user.id, { phoneVerified: true });

    await this.tokenRepository.markAsUsed(tokenDoc.id);

    await this.eventPublisher.publish({
      eventType: 'user.phone_verified',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
      },
      userId: user.id,
    });

    this.logger.info('Phone verified', {
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });
  }

  public async requestVerification(userId: string, dto: RequestVerificationDto): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (dto.type === 'email') {
      if (user.emailVerified) {
        throw new ConflictError('Email already verified');
      }

      await this.tokenRepository.invalidateUserTokens(user.id, TokenType.EMAIL_VERIFICATION);

      const verificationToken = await this.createVerificationToken(
        user.id,
        TokenType.EMAIL_VERIFICATION,
        this.EMAIL_VERIFICATION_EXPIRY_HOURS,
        true,
      );

      console.log('Verification token:', verificationToken);

      await this.eventPublisher.publish({
        eventType: 'user.email_verification_requested',
        aggregateType: 'auth',
        aggregateId: user.id,
        payload: {
          email: user.email,
          firstName: user.firstName,
          verificationToken,
        },
        userId: user.id,
      });
    } else if (dto.type === 'phone') {
      if (!user.phoneNumber) {
        throw new ConflictError('No phone number associated with account');
      }

      if (user.phoneVerified) {
        throw new ConflictError('Phone already verified');
      }

      await this.tokenRepository.invalidateUserTokens(user.id, TokenType.PHONE_VERIFICATION);

      const verificationCode = await this.createVerificationToken(
        user.id,
        TokenType.PHONE_VERIFICATION,
        this.PHONE_VERIFICATION_EXPIRY_MINUTES / 60,
        true,
      );

      await this.eventPublisher.publish({
        eventType: 'user.phone_verification_requested',
        aggregateType: 'auth',
        aggregateId: user.id,
        payload: {
          email: user.email,
          firstName: user.firstName,
          phoneNumber: user.phoneNumber,
          verificationCode,
        },
        userId: user.id,
      });
    }

    this.logger.info('Verification requested', {
      userId: user.id,
      type: dto.type,
    });
  }

  public async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const secret = process.env.JWT_REFRESH_SECRET;
      if (!secret) {
        throw new Error('JWT_REFRESH_SECRET not configured');
      }

      const decoded = jwt.verify(refreshToken, secret) as {
        userId: string;
        email: string;
        role: string;
        permissions: string[];
      };

      const user = await this.userRepository.findById(decoded.userId);

      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account is inactive');
      }

      await this.userRepository.removeRefreshToken(user.id, refreshToken);

      const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

      await this.userRepository.addRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  public async logout(userId: string, refreshToken: string): Promise<void> {
    await this.userRepository.removeRefreshToken(userId, refreshToken);

    await this.eventPublisher.publish({
      eventType: 'user.logged_out',
      aggregateType: 'auth',
      aggregateId: userId,
      payload: {},
      userId,
    });
  }

  public async logoutAll(userId: string): Promise<void> {
    await this.userRepository.removeAllRefreshTokens(userId);

    await this.eventPublisher.publish({
      eventType: 'user.logged_out_all',
      aggregateType: 'auth',
      aggregateId: userId,
      payload: {},
      userId,
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    permissions: string[],
  ): Promise<TokenPair> {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    const payload = { userId, email, role, permissions };

    const accessToken = jwt.sign(payload, accessSecret, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, refreshSecret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  private async createVerificationToken(
    userId: string,
    type: TokenType,
    expiryHours: number,
    useNumericCode: boolean = false,
  ): Promise<string> {
    const token = useNumericCode
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : crypto.randomBytes(32).toString('hex');

    this.logger.info('Generated verification token', {
      userId,
      type,
      token: useNumericCode ? '******' : token,
    });

    this.logger.info('Generated verification token', {
      userId,
      type,
      token: useNumericCode ? '******' : token,
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    await this.tokenRepository.create({
      userId: new Types.ObjectId(userId),
      token,
      type,
      expiresAt,
      isUsed: false,
    });

    return token;
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    await this.userRepository.incrementFailedLoginAttempts(userId);

    const user = await this.userRepository.findById(userId);

    if (user && user.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60000);
      await this.userRepository.lockAccount(userId, lockUntil);

      await this.eventPublisher.publish({
        eventType: 'user.account_locked',
        aggregateType: 'auth',
        aggregateId: userId,
        payload: {
          lockedUntil: lockUntil,
          reason: 'Too many failed login attempts',
        },
        userId,
      });
    }
  }

  private getPermissionsForRole(role: string): string[] {
    const permissionsMap: Record<string, string[]> = {
      admin: [
        'user:create',
        'user:read',
        'user:update',
        'user:delete',
        'loan:create',
        'loan:read',
        'loan:update',
        'loan:delete',
        'loan:approve',
        'loan:reject',
        'loan:disburse',
        'payment:create',
        'payment:read',
        'payment:update',
        'report:read',
      ],
      loan_officer: [
        'user:read',
        'loan:create',
        'loan:read',
        'loan:update',
        'loan:approve',
        'loan:reject',
        'payment:read',
        'report:read',
      ],
      finance: [
        'loan:read',
        'loan:disburse',
        'payment:create',
        'payment:read',
        'payment:update',
        'report:read',
      ],
      applicant: ['loan:create', 'loan:read', 'payment:read'],
    };

    return permissionsMap[role] || [];
  }
}
