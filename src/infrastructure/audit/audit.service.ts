import { DomainEvent } from '../events/event-publisher';
import { EventSubscriber,  } from '../events/event-subscriber';
import { Logger } from '../logging/logger';
import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  userId?: string;
  payload: any;
  timestamp: Date;
  correlationId?: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    payload: Schema.Types.Mixed,
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    correlationId: String,
  },
  {
    timestamps: false,
  }
);

const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export class AuditService {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const subscriber = new EventSubscriber();

    subscriber.subscribe('audit-queue', ['#'], async (event) => {
      await this.logEvent(event);
    });
  }

  private async logEvent(event: DomainEvent): Promise<void> {
    try {
      await AuditLogModel.create({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        userId: event.userId,
        payload: event.payload,
        timestamp: event.timestamp,
        correlationId: event.correlationId,
      });

      this.logger.audit(
        event.eventType,
        event.userId || 'system',
        `${event.aggregateType}:${event.aggregateId}`,
        { payload: event.payload }
      );
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
    }
  }

  public async getAuditLogs(filters: {
    aggregateType?: string;
    aggregateId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<IAuditLog[]> {
    const query: any = {};

    if (filters.aggregateType) query.aggregateType = filters.aggregateType;
    if (filters.aggregateId) query.aggregateId = filters.aggregateId;
    if (filters.userId) query.userId = filters.userId;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return await AuditLogModel.find(query).sort({ timestamp: -1 }).limit(100);
  }
}
