import { CustomerRepository } from './customer.repository';
import { ICustomer } from './customer.model';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { NotFoundError } from '../../shared/errors/app-error';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { Types } from 'mongoose';
import { userService } from '../user/user.service';

export class CustomerService {
  private repository: CustomerRepository;
  private eventPublisher: EventPublisher;

  constructor() {
    this.repository = new CustomerRepository();
    this.eventPublisher = new EventPublisher();
  }

  public async create(userId: string, dto: CreateCustomerDto): Promise<ICustomer> {
    const entity = await this.repository.create({
      ...dto,
      userId: new Types.ObjectId(userId),
    });

    await userService.linkCustomer(userId, entity._id);

    await this.eventPublisher.publish({
      eventType: 'customer.created',
      aggregateType: 'customer',
      aggregateId: entity.id,
      payload: dto,
      userId,
    });

    return entity;
  }

  public async getById(id: string): Promise<ICustomer> {
    const entity = await this.repository.findById(id);

    if (!entity) {
      throw new NotFoundError('Customer');
    }

    return entity;
  }

  public async getAll(options: QueryOptions): Promise<PaginatedResult<ICustomer>> {
    return await this.repository.findAll(options);
  }

  public async update(id: string, userId: string, dto: UpdateCustomerDto): Promise<ICustomer> {
    const entity = await this.repository.findById(id);

    if (!entity) {
      throw new NotFoundError('Customer');
    }

    const updated = await this.repository.update(id, dto);

    if (!updated) {
      throw new NotFoundError('Customer');
    }

    await this.eventPublisher.publish({
      eventType: 'customer.updated',
      aggregateType: 'customer',
      aggregateId: id,
      payload: { changes: dto },
      userId,
    });

    return updated;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const entity = await this.repository.findById(id);

    if (!entity) {
      throw new NotFoundError('Customer');
    }

    await this.repository.delete(id);

    await this.eventPublisher.publish({
      eventType: 'customer.deleted',
      aggregateType: 'customer',
      aggregateId: id,
      payload: {},
      userId,
    });
  }
}
