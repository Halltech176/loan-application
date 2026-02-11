import { TokenRepository } from './token.repository';
import { IToken } from './token.model';
import { CreateTokenDto, UpdateTokenDto } from './dto/token.dto';
import { NotFoundError } from '../../shared/errors/app-error';
import { QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { EventPublisher } from '../../infrastructure/events/event-publisher';

export class TokenService {
  private repository: TokenRepository;
  private eventPublisher: EventPublisher;

  constructor() {
    this.repository = new TokenRepository();
    this.eventPublisher = new EventPublisher();
  }

  public async create(userId: string, dto: CreateTokenDto): Promise<IToken> {
    const entity = await this.repository.create(dto);

    await this.eventPublisher.publish({
      eventType: 'token.created',
      aggregateType: 'token',
      aggregateId: entity.id,
      payload: dto,
      userId,
    });

    return entity;
  }

  public async getById(id: string): Promise<IToken> {
    const entity = await this.repository.findById(id);
    
    if (!entity) {
      throw new NotFoundError('Token');
    }

    return entity;
  }

  public async getAll(options: QueryOptions): Promise<PaginatedResult<IToken>> {
    return await this.repository.findAll(options);
  }

  public async update(id: string, userId: string, dto: UpdateTokenDto): Promise<IToken> {
    const entity = await this.repository.findById(id);
    
    if (!entity) {
      throw new NotFoundError('Token');
    }

    const updated = await this.repository.update(id, dto);

    if (!updated) {
      throw new NotFoundError('Token');
    }

    await this.eventPublisher.publish({
      eventType: 'token.updated',
      aggregateType: 'token',
      aggregateId: id,
      payload: { changes: dto },
      userId,
    });

    return updated;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const entity = await this.repository.findById(id);
    
    if (!entity) {
      throw new NotFoundError('Token');
    }

    await this.repository.delete(id);

    await this.eventPublisher.publish({
      eventType: 'token.deleted',
      aggregateType: 'token',
      aggregateId: id,
      payload: {},
      userId,
    });
  }
}
