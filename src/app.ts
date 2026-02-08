import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { errorHandler } from './shared/middleware/error-handler';
import { requestLogger } from './shared/middleware/request-logger';
import { router } from './routes';
import { notFoundHandler } from './shared/middleware/not-found-handler';
import { rateLimiter } from './shared/middleware/rate-limiter';

export class App {
  private app: Application;

  constructor() {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      }),
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(mongoSanitize());
    this.app.use(hpp());
    this.app.use(requestLogger);
    this.app.use(rateLimiter);
  }

  private configureRoutes(): void {
    this.app.get('/health', (_, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    this.app.use('/api/v1', router);
  }

  private configureErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public listen(port: number | string, callback?: () => void): void {
    this.app.listen(port, callback);
  }

  public getApp(): Application {
    return this.app;
  }
}
