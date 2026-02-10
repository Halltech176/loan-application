import { RabbitMQConnection } from '../../infrastructure/messaging/rabbitmq-connection';
import { Logger } from '../../infrastructure/logging/logger';
import { DomainEvent } from './event-publisher';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export class EventSubscriber {
  private rabbitmq: RabbitMQConnection;
  private logger: Logger;

  constructor() {
    this.rabbitmq = RabbitMQConnection.getInstance();
    this.logger = Logger.getInstance();
  }

  public async subscribe(
    queueName: string,
    eventPatterns: string[],
    handler: EventHandler,
  ): Promise<void> {
    try {
      await this.rabbitmq.subscribe(queueName, eventPatterns, async (message) => {
        const event = message as DomainEvent;

        this.logger.info('Event received', {
          eventId: event.eventId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
        });

        try {
          await handler(event);

          this.logger.debug('Event processed successfully', {
            eventId: event.eventId,
          });
        } catch (error) {
          this.logger.error('Event handler failed', {
            eventId: event.eventId,
            error,
          });
          throw error;
        }
      });

      this.logger.info(`Subscribed to events`, {
        queueName,
        patterns: eventPatterns,
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to events', {
        queueName,
        error,
      });
      throw error;
    }
  }
}
