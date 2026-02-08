import jwt from 'jsonwebtoken';
import { UserRepository } from '../user/user.repository';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ConflictError, UnauthorizedError } from '../../shared/errors/app-error';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { Logger } from '../../infrastructure/logging/logger';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions: string[];
  };
  tokens: TokenPair;
}

export class AuthService {
  private repository: UserRepository;
  private eventPublisher: EventPublisher;
  private logger: Logger;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;

  constructor() {
    this.repository = new UserRepository();
    this.eventPublisher = new EventPublisher();
    this.logger = Logger.getInstance();
  }

  public async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.repository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const user = await this.repository.create({
      email: dto.email.toLowerCase(),
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'applicant',
      permissions: this.getPermissionsForRole('applicant'),
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

    await this.repository.addRefreshToken(user.id, tokens.refreshToken);

    await this.eventPublisher.publish({
      eventType: 'user.registered',
      aggregateType: 'auth',
      aggregateId: user.id,
      payload: {
        email: user.email,
        role: user.role,
      },
      userId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
      },
      tokens,
    };
  }

  public async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.repository.findByEmail(dto.email);

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

    await this.repository.resetFailedLoginAttempts(user.id);
    await this.repository.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

    await this.repository.addRefreshToken(user.id, tokens.refreshToken);

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
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
      },
      tokens,
    };
  }

  public async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const secret = process.env.JWT_REFRESH_SECRET;
      if (!secret) {
        throw new Error('JWT_REFRESH_SECRET not configured');
      }

      console.log('Verifying refresh token:', refreshToken);

      const decoded = jwt.verify(refreshToken, secret) as {
        userId: string;
        email: string;
        role: string;
        permissions: string[];
      };

      const user = await this.repository.findById(decoded.userId);

      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account is inactive');
      }

      await this.repository.removeRefreshToken(user.id, refreshToken);

      const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions);

      await this.repository.addRefreshToken(user.id, tokens.refreshToken);

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
    await this.repository.removeRefreshToken(userId, refreshToken);

    await this.eventPublisher.publish({
      eventType: 'user.logged_out',
      aggregateType: 'auth',
      aggregateId: userId,
      payload: {},
      userId,
    });
  }

  public async logoutAll(userId: string): Promise<void> {
    await this.repository.removeAllRefreshTokens(userId);

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

    // Option 1: Type assertion
    const accessToken = jwt.sign(payload, accessSecret, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, refreshSecret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    await this.repository.incrementFailedLoginAttempts(userId);

    const user = await this.repository.findById(userId);

    if (user && user.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60000);
      await this.repository.lockAccount(userId, lockUntil);

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
