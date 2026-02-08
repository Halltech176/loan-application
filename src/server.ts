import 'reflect-metadata';
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
dotenv.config();

import { App } from './app';
import { Logger } from './infrastructure/logging/logger';
import { DatabaseConnection } from './infrastructure/database/connection';
import { RedisConnection } from './infrastructure/cache/redis-connection';
import { RabbitMQConnection } from './infrastructure/messaging/rabbitmq-connection';
import { EmailService } from './infrastructure/email/email.service';
import { AuditService } from './infrastructure/audit/audit.service';

const logger = Logger.getInstance();

async function bootstrap(): Promise<void> {
  try {
    await DatabaseConnection.getInstance().connect();
    logger.info('Database connected successfully');

    await RedisConnection.getInstance().connect();
    logger.info('Redis connected successfully');

    await RabbitMQConnection.getInstance().connect();
    logger.info('RabbitMQ connected successfully');

    const emailService = new EmailService();
    emailService.setupEventListeners();
    logger.info('Email service initialized and event listeners set up');

    new AuditService();

    logger.info('Audit service initialized');

    const app = new App();
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      await gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      await gracefulShutdown();
    });
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

async function gracefulShutdown(): Promise<void> {
  try {
    await RabbitMQConnection.getInstance().disconnect();
    await RedisConnection.getInstance().disconnect();
    await DatabaseConnection.getInstance().disconnect();
    logger.info('Application shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

bootstrap();
