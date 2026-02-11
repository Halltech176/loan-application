# Loan Application Platform - Architecture Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Communication](#system-communication)
3. [Database Schema Design](#database-schema-design)
4. [Reliability & Consistency](#reliability--consistency)
5. [Tradeoffs & Future Improvements](#tradeoffs--future-improvements)

---

## Architecture Overview

### Chosen Architecture: Clean Architecture on the Code Level and Modular Monolith on System Level with Event-Driven Design

**Why Clean Architecture?**

**Clean Architecture** was adopted for several reasons:

1. **Separation of Concerns**: Business logic is completely isolated from infrastructure concerns (databases, frameworks, external services)
2. **Testability**: Domain logic can be tested without databases, web frameworks, or external dependencies
3. **Technology Independence**: We can swap MongoDB for PostgreSQL, Express for Fastify, or RabbitMQ for Kafka without touching business rules
4. **Maintainability**: Changes to external systems don't ripple through the codebase
5. **Team Scalability**: Different teams can work on different layers

**Layer Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (Routes, Controllers, Middleware, Guards, DTOs)            │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (Services - Business Logic & Use Cases)                    │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                            │
│  (Models, Entities, Business Rules)                         │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                        │
│  (Database, Cache, Messaging, Email, Logging, Events)      │
└─────────────────────────────────────────────────────────────┘
```

### Why Event-Driven Design?

Complemented Architecture with **Event-Driven Architecture** because:

1. **Loose Coupling**: Modules don't directly call each other; they communicate through events
2. **Scalability**: Event consumers can be scaled independently
3. **Audit Trail**: Every state change is an event, giving us complete system history
4. **Async Processing**: Long-running operations (emails, disbursements) don't block HTTP responses
5. **Future-Proof**: Easy to add new features by simply subscribing to existing events

**Example Flow**:

```
User submits loan → Service emits "loan.submitted" event → Multiple subscribers:
  1. Audit service logs the action
  2. Email service sends confirmation
  3. Log was tracked for the sake of audit
```

### Architectural Diagrams

**Note**: Detailed architectural diagrams (system overview, component interactions, ERD) will be provided separately as image files.

---

## System Communication

### Communication Patterns

I use **three distinct communication patterns**, each chosen for specific use cases:

#### 1. Synchronous REST API (Request-Response)

**When**: User-facing operations requiring immediate feedback

**How**: HTTP/JSON over Express.js

**Examples**:

- User login → Immediate token response
- Fetch loan applications → Immediate data return
- Submit loan application → Immediate confirmation

#### 2. Asynchronous Messaging (Publish-Subscribe)

**When**: Background processing, cross-module communication, audit logging

**Examples**:

- Loan approved → Email service + Audit service + Disbursment Service
- User registered → Send welcome email + Create customer profile + Log audit

**Message Flow**:

```
┌──────────┐    Publish      ┌──────────┐    Route     ┌─────────────┐
│ Service  │ ──────────────> │ RabbitMQ │ ───────────> │ Subscribers │
│(Publisher)│  loan.approved  │ Exchange │   Pattern    │  (Multiple) │
└──────────┘                  └──────────┘   Matching   └─────────────┘
                                  │
                      ┌───────────┼───────────┐
                      │           │           │
                   Queue1      Queue2      Queue3
                   (Audit)     (Email)   (Analytics)
```

#### 3. Cache-Based Communication

**When**: Performance optimization, distributed locking, session management

**Examples**:

- Distributed locks: Prevent concurrent loan approvals
- Idempotency: Cache responses to prevent duplicate operations
- Rate limiting: Track request counts per user/IP

## Reliability & Consistency

### Failure Handling

#### 1. Database Failures

**Scenario**: MongoDB connection lost during operation

**Handling**:

```typescript
// Automatic reconnection
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on('disconnected', () => {
  logger.error('MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});
```

#### 2. Message Queue Failures

**Scenario**: RabbitMQ crashes, messages in transit lost

**Prevention**:

```typescript
// Durable queues + persistent messages
await channel.assertQueue(queueName, { durable: true });
channel.publish(exchange, routingKey, content, { persistent: true });

// Message acknowledgment
channel.consume(queue, async (msg) => {
  try {
    await processMessage(msg);
    channel.ack(msg); // Success
  } catch (error) {
    channel.nack(msg, false, true); // Retry
  }
});
```

**Impact**:

- Messages survive broker restarts
- Failed messages requeue automatically

#### 3. Redis Failures

**Scenario**: Redis becomes unavailable

**Handling**:

```typescript
// Graceful degradation
async function acquireLock(key: string): Promise<boolean> {
  try {
    return (await redis.set(key, '1', 'EX', 30, 'NX')) === 'OK';
  } catch (error) {
    logger.warn('Redis unavailable, proceeding without lock');
    return true;
  }
}
```

**Impact**:

- Distributed locks degrade gracefully (race condition risk increases)
- Idempotency checks fail-open (duplicate risk increases)

### Concurrency Control

#### 1. Optimistic Locking

**Scenario**: Two loan officers try to approve the same loan simultaneously

**Implementation**:

```typescript
// Loan document has version field
{ _id: "loan-123", status: "submitted", version: 5 }

// Update with version check
const result = await LoanModel.findOneAndUpdate(
  { _id: loanId, version: currentVersion },  // Match version
  {
    $set: { status: 'approved' },
    $inc: { version: 1 }  // Increment version
  },
  { new: true }
);

if (!result) {
  throw new ConflictError('Loan was modified by another user');
}
```

**Outcome**: Second update fails with 409 Conflict, preventing overwrite

#### 2. Distributed Locks (Redis)

**Scenario**: Prevent concurrent disbursement of the same loan

**Implementation**:

```typescript
async function createDisbursement(loanId: string): Promise<void> {
  const lockKey = `lock:disbursement:${loanId}`;
  const lockAcquired = await redis.acquireLock(lockKey, 30);

  if (!lockAcquired) {
    throw new ConflictError('Disbursement already in progress');
  }

  try {
    // Check if disbursement exists
    const existing = await disbursementRepository.findByLoanId(loanId);
    if (existing) {
      throw new ConflictError('Loan already disbursed');
    }

    // Create disbursement
    await disbursementRepository.create({ loanId, ... });
  } finally {
    await redis.releaseLock(lockKey);
  }
}
```

**Protection**: Only one disbursement can be created per loan, even across servers

#### 3. Database Constraints

**Scenario**: Prevent duplicate BVN or account numbers

**Implementation**:

```typescript
// Unique index at database level
customerSchema.index({ 'bankDetails.bvn': 1 }, { unique: true });
creditApprovalSchema.index({ loanApplicationId: 1 }, { unique: true });
```

**Outcome**: MongoDB rejects duplicate writes with E11000 error

#### 4. Idempotency Guards

**Scenario**: User clicks "Submit Loan" twice due to slow network

**Implementation**:

```typescript
// Client sends idempotency key
POST /api/v1/loan-applications
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

// Server checks cache
const cacheKey = `idempotency:${idempotencyKey}`;
const cached = await redis.get(cacheKey);

if (cached) {
  // Return cached response
  return JSON.parse(cached);
}

// Process request and cache response
const result = await createLoanApplication(...);
await redis.setex(cacheKey, 86400, JSON.stringify(result));
return result;
```

**Protection**: Duplicate requests return same result, no duplicate loans created

### Data Integrity

#### 1. Input Validation

**Layer 1**: DTO validation with class-validator

```typescript
@IsEmail()
@IsNotEmpty()
email!: string;

@Min(1000)
@Max(10000000)
amount!: number;
```

**Layer 2**: Mongoose schema validation

```typescript
{
  email: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  }
}
```

**Defense in Depth**: Both layers must pass

#### 2. Business Rule Validation

**Example**: Can't approve a loan that's already disbursed

```typescript
async function approveLoan(loanId: string): Promise<void> {
  const loan = await loanRepository.findById(loanId);

  // Business rule checks
  if (loan.status !== 'submitted') {
    throw new UnprocessableEntityError('Can only approve submitted loans', 'INVALID_LOAN_STATUS');
  }

  const disbursement = await disbursementRepository.findByLoanId(loanId);
  if (disbursement) {
    throw new ConflictError('Loan already disbursed', 'ALREADY_DISBURSED');
  }

  // Proceed with approval
}
```

#### 3. Audit Trail

**All state changes logged immutably**:

```typescript
// Every event creates audit log
{
  eventId: "uuid",
  eventType: "loan.approved",
  aggregateType: "loan",
  aggregateId: "loan-123",
  userId: "officer-456",
  timestamp: "2025-02-05T10:30:00Z",
  payload: { previousStatus: "submitted", newStatus: "approved" }
}

// Audit logs are append-only, never updated/deleted
```

**Benefits**:

- Complete history of all actions
- Fraud detection and investigation
- Regulatory compliance (financial audit trails)
- Debugging production issues

---

## Tradeoffs & Future Improvements

### Tradeoffs Made

#### 1. Modular Monolith vs Microservices

**Chose**: Modular Monolith

**Why**:

- Simpler deployment (one artifact)
- Easier debugging (single process)
- Lower operational overhead (no service mesh, API gateway, distributed tracing)
- Better performance (no network calls between modules)

**Trade-offs**:

- Scales as a unit (can't scale loan module independently)
- Tighter deployment coupling

**Would Reconsider If**: System grows beyond 10 modules, different modules need different scaling characteristics, multiple teams working on different release cycles

### What Would Be Improved With More Time

#### Short-Term Improvements (1-4 weeks)

##### 1. Comprehensive Test Coverage

##### 2. API Documentation (Standard API documentation and report)

##### 3. Performance Monitoring

##### 4. Advanced Credit scoring

##### 5. Document Management System ( For Uploaded Files)

##### 6. Integrate standard external API services for Payment, Credit score and services I used mocked implementation for
