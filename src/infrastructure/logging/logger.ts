import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const logDir = process.env.LOG_FILE_PATH || './logs';
    const logLevel = process.env.LOG_LEVEL || 'info';

    const transportApplication: DailyRotateFile = new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: logLevel,
    });

    const transportError: DailyRotateFile = new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    });

    const transportAudit: DailyRotateFile = new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'info',
    });

    const transportSecurity: DailyRotateFile = new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'warn',
    });

    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        transportApplication,
        transportError,
        transportAudit,
        transportSecurity,
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      ],
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, error?: any): void {
    this.logger.error(message, { error: this.serializeError(error) });
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public audit(action: string, userId: string, resource: string, meta?: any): void {
    const auditTransport = new DailyRotateFile({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
    });

    const auditLogger = winston.createLogger({
      format: winston.format.json(),
      transports: [auditTransport],
    });

    auditLogger.info({
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  public security(event: string, meta?: any): void {
    const securityTransport = new DailyRotateFile({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
    });

    const securityLogger = winston.createLogger({
      format: winston.format.json(),
      transports: [securityTransport],
    });

    securityLogger.warn({
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    return error;
  }
}
