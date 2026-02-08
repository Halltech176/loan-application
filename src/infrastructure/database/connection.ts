import mongoose from 'mongoose';
import { Logger } from '../logging/logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/loan-platform';

      await mongoose.connect(mongoUri);

      mongoose.connection.on('connected', () => {
        this.logger.info('MongoDB connected');
      });

      mongoose.connection.on('error', (err) => {
        this.logger.error('MongoDB connection error', err);
      });

      mongoose.connection.on('disconnected', () => {
        this.logger.warn('MongoDB disconnected');
      });
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await mongoose.connection.close();
    this.logger.info('MongoDB connection closed');
  }

  public getConnection(): typeof mongoose {
    return mongoose;
  }
}
