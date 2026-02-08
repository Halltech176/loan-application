import { RedisConnection } from '../../infrastructure/cache/redis-connection';
import { Logger } from '../../infrastructure/logging/logger';

export class DistributedLock {
  private redis: RedisConnection;
  private logger: Logger;

  constructor() {
    this.redis = RedisConnection.getInstance();
    this.logger = Logger.getInstance();
  }

  public async acquire(
    key: string,
    ttl: number = 30,
    maxRetries: number = 3,
    retryDelay: number = 100
  ): Promise<boolean> {
    let retries = 0;

    while (retries < maxRetries) {
      const acquired = await this.redis.acquireLock(key, ttl);
      
      if (acquired) {
        this.logger.debug(`Lock acquired: ${key}`);
        return true;
      }

      retries++;
      if (retries < maxRetries) {
        await this.sleep(retryDelay * retries);
      }
    }

    this.logger.warn(`Failed to acquire lock: ${key}`);
    return false;
  }

  public async release(key: string): Promise<void> {
    await this.redis.releaseLock(key);
    this.logger.debug(`Lock released: ${key}`);
  }

  public async executeWithLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 30
  ): Promise<T> {
    const acquired = await this.acquire(key, ttl);

    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${key}`);
    }

    try {
      return await callback();
    } finally {
      await this.release(key);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
