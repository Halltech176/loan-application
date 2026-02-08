import Redis from 'ioredis';
import { Logger } from '../logging/logger';

export class RedisConnection {
  private static instance: RedisConnection;
  private client: Redis | null = null;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.logger.info('Redis connected');
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis connection error', err);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.info('Redis connection closed');
    }
  }

  public getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  public async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.getClient().setex(key, ttl, value);
    } else {
      await this.getClient().set(key, value);
    }
  }

  public async del(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  public async exists(key: string): Promise<boolean> {
    const result = await this.getClient().exists(key);
    return result === 1;
  }

  public async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    const result = await this.getClient().set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  public async releaseLock(key: string): Promise<void> {
    await this.getClient().del(key);
  }
}
