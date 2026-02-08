import amqp from 'amqplib';
import { Logger } from '../logging/logger';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

export class RabbitMQConnection {
  private static instance: RabbitMQConnection;
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private logger: Logger;
  private readonly exchange: string;

  private constructor() {
    this.logger = Logger.getInstance();
    this.exchange = process.env.RABBITMQ_EXCHANGE || 'loan-platform-exchange';
  }

  public static getInstance(): RabbitMQConnection {
    if (!RabbitMQConnection.instance) {
      RabbitMQConnection.instance = new RabbitMQConnection();
    }
    return RabbitMQConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel');
      }

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      this.logger.info('RabbitMQ connected');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.info('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }

  public getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }

  public getExchange(): string {
    return this.exchange;
  }

  public async publish(routingKey: string, message: any): Promise<void> {
    const channel = this.getChannel();
    const content = Buffer.from(JSON.stringify(message));

    channel.publish(this.exchange, routingKey, content, {
      persistent: true,
      timestamp: Date.now(),
    });

    this.logger.debug(`Published message to ${routingKey}`, { message });
  }

  public async subscribe(
    queueName: string,
    routingKeys: string[],
    callback: (message: any) => Promise<void>,
  ): Promise<void> {
    const channel = this.getChannel();

    await channel.assertQueue(queueName, { durable: true });

    for (const routingKey of routingKeys) {
      await channel.bindQueue(queueName, this.exchange, routingKey);
    }

    channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        } catch (error) {
          this.logger.error('Error processing message', error);
          channel.nack(msg, false, false);
        }
      }
    });

    this.logger.info(`Subscribed to queue: ${queueName}`);
  }
}
