import { UserRepository } from './user.repository';
import { IUser } from './user.model';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';
import { NotFoundError, ConflictError, UnauthorizedError } from '../../shared/errors/app-error';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import bcrypt from 'bcryptjs';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { Types } from 'mongoose';

export class UserService {
  private repository: UserRepository;
  private eventPublisher: EventPublisher;

  constructor() {
    this.repository = new UserRepository();
    this.eventPublisher = new EventPublisher();
  }

  public async createUser(dto: CreateUserDto): Promise<IUser> {
    const existingUser = await this.repository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );

    const user = await this.repository.create({
      ...dto,
      password: hashedPassword,
    });

    await this.eventPublisher.publish({
      eventType: 'user.created',
      aggregateType: 'user',
      aggregateId: user.id,
      payload: {
        email: user.email,
        role: user.role,
      },
    });

    return user;
  }

  public async getUserById(id: string): Promise<IUser> {
    const user = await this.repository.findById(id, 'customerId');

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  public async getUsers(options: QueryOptions): Promise<PaginatedResult<IUser>> {
    return await this.repository.findAll(options);
  }

  public async updateUser(id: string, dto: UpdateUserDto): Promise<IUser> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await this.repository.update(id, dto);

    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    await this.eventPublisher.publish({
      eventType: 'user.updated',
      aggregateType: 'user',
      aggregateId: updatedUser.id,
      payload: {
        changes: dto,
      },
    });

    return updatedUser;
  }

  public async linkCustomer(userId: string, customerId: Types.ObjectId): Promise<IUser> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await this.repository.update(userId, { customerId });

    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    return updatedUser;
  }

  public async deleteUser(id: string): Promise<void> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundError('User');
    }

    await this.repository.delete(id);

    await this.eventPublisher.publish({
      eventType: 'user.deleted',
      aggregateType: 'user',
      aggregateId: id,
      payload: {
        email: user.email,
      },
    });
  }

  public async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );

    await this.repository.update(userId, { password: hashedPassword });

    await this.eventPublisher.publish({
      eventType: 'user.password_changed',
      aggregateType: 'user',
      aggregateId: userId,
      payload: {},
    });
  }
}

export const userService = new UserService();
