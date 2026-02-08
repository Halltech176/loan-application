import { RabbitMQConnection } from '../../infrastructure/messaging/rabbitmq-connection';
import { Logger } from '../../infrastructure/logging/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  userId?: string;
  timestamp: Date;
  correlationId?: string;
}

export class EventPublisher {
  private rabbitmq: RabbitMQConnection;
  private logger: Logger;

  constructor() {
    this.rabbitmq = RabbitMQConnection.getInstance();
    this.logger = Logger.getInstance();
  }

  public async publish(event: Omit<DomainEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const domainEvent: DomainEvent = {
      ...event,
      eventId: uuidv4(),
      timestamp: new Date(),
    };

    const routingKey = `${event.aggregateType}.${event.eventType}`;

    try {
      await this.rabbitmq.publish(routingKey, domainEvent);
      
      this.logger.info('Event published', {
        eventId: domainEvent.eventId,
        eventType: domainEvent.eventType,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
      });
    } catch (error) {
      this.logger.error('Failed to publish event', {
        event: domainEvent,
        error,
      });
      throw error;
    }
  }
}
