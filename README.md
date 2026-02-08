# Loan Application Platform

A production-ready, enterprise-grade loan application platform built with Node.js, TypeScript, MongoDB, Redis, and RabbitMQ.

## Features

### Core Functionality

- ✅ User Management with RBAC (Role-Based Access Control)
- ✅ Complete Authentication System (Register, Login, Refresh Token, Logout)
- ✅ Loan Application Lifecycle Management
- ✅ Credit Approval System
- ✅ Automated Disbursement Processing
- ✅ Repayment & Payment Tracking
- ✅ Event-Driven Architecture
- ✅ Audit Logging System
- ✅ Email Notifications

### Technical Features

- ✅ Clean Architecture with separation of concerns
- ✅ TypeScript with strict mode
- ✅ JWT Authentication with refresh tokens
- ✅ Permission-based authorization
- ✅ Rate limiting & brute force protection
- ✅ Distributed locks using Redis
- ✅ Idempotency guards for critical operations
- ✅ Event sourcing with RabbitMQ
- ✅ Comprehensive error handling
- ✅ Request/Response logging
- ✅ Database migrations
- ✅ Docker & Docker Compose ready
- ✅ API pagination, filtering & sorting
- ✅ Optimistic locking
- ✅ Retry strategies

## Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript (strict mode)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Authentication**: JWT (Access & Refresh tokens)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest
- **Logging**: Winston
- **Code Generation**: Plop.js
- **Containerization**: Docker & Docker Compose

## Architecture

### Clean Architecture Layers

```
src/
├── modules/              # Business logic modules
│   ├── auth/            # Authentication module
│   ├── user/            # User management
│   ├── loan-application/# Loan applications
│   ├── credit-approval/ # Credit approvals
│   ├── disbursement/    # Loan disbursement
│   └── repayment/       # Payment management
├── infrastructure/       # External services & frameworks
│   ├── database/        # MongoDB connection
│   ├── cache/           # Redis connection
│   ├── messaging/       # RabbitMQ connection
│   ├── logging/         # Winston logger
│   ├── email/           # Email service
│   ├── audit/           # Audit logging
│   └── events/          # Event publisher/subscriber
├── shared/              # Shared utilities
│   ├── errors/          # Custom error classes
│   ├── guards/          # Auth, Role, Permission guards
│   ├── middleware/      # Express middleware
│   └── utils/           # Helper utilities
└── test/                # Test setup & utilities
```

### Module Structure

Each module follows a consistent structure:

```
module-name/
├── module-name.model.ts      # Mongoose model
├── module-name.repository.ts # Data access layer
├── module-name.service.ts    # Business logic
├── module-name.controller.ts # HTTP request handlers
├── module-name.routes.ts     # Route definitions
├── dto/                      # Data Transfer Objects
│   └── module-name.dto.ts
└── tests/                    # Module-specific tests
```

## Installation & Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MongoDB 7+
- Redis 7+
- RabbitMQ 3+

### Using Docker (Recommended)

1. Clone the repository
2. Copy environment variables:

```bash
cp .env.example .env
```

3. Start all services:

```bash
docker-compose up -d
```

4. Run migrations:

```bash
docker-compose exec app npm run migrate:up
```

5. The API will be available at `http://localhost:3000`

### Manual Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration

4. Start MongoDB, Redis, and RabbitMQ locally

5. Run migrations:

```bash
npm run migrate:up
```

6. Start the development server:

```bash
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

Key variables:

- `MONGODB_URI`: MongoDB connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `RABBITMQ_URL`: RabbitMQ connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: JWT secrets
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`: SMTP configuration

## API Documentation

### Authentication Endpoints

#### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Loan Application Endpoints

#### Create Loan Application

```http
POST /api/v1/loan-applications
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "amount": 50000,
  "purpose": "Business expansion",
  "term": 24,
  "interestRate": 12.5,
  "creditScore": 750
}
```

#### Get All Applications (with pagination, filtering)

```http
GET /api/v1/loan-applications?page=1&limit=10&status=submitted&sort=-createdAt
Authorization: Bearer {access_token}
```

#### Submit Application

```http
POST /api/v1/loan-applications/{id}/submit
Authorization: Bearer {access_token}
Idempotency-Key: {unique-key}
```

#### Review Application (Approve/Reject)

```http
POST /api/v1/loan-applications/{id}/review
Authorization: Bearer {access_token}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "decision": "approve",
  "reviewNotes": "Application meets all criteria"
}
```

### Disbursement Endpoints

#### Create Disbursement

```http
POST /api/v1/disbursements
Authorization: Bearer {access_token}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "loanApplicationId": "loan-id",
  "amount": 50000,
  "recipientAccount": {
    "accountNumber": "1234567890",
    "accountName": "John Doe",
    "bankName": "Example Bank",
    "bankCode": "001"
  }
}
```

### Repayment Endpoints

#### Create Repayment Schedule

```http
POST /api/v1/repayments
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "loanApplicationId": "loan-id",
  "amount": 2500,
  "principalAmount": 2083.33,
  "interestAmount": 416.67,
  "dueDate": "2025-02-01T00:00:00.000Z"
}
```

#### Record Payment

```http
POST /api/v1/repayments/{id}/record-payment
Authorization: Bearer {access_token}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "paymentMethod": "bank_transfer",
  "transactionReference": "TXN123456"
}
```

## RBAC (Role-Based Access Control)

### Roles

- **Admin**: Full system access
- **Loan Officer**: Can review and approve loans
- **Finance**: Can disburse funds and manage payments
- **Applicant**: Can create and view own applications

### Permissions

```
user:create, user:read, user:update, user:delete
loan:create, loan:read, loan:update, loan:delete
loan:approve, loan:reject, loan:disburse
payment:create, payment:read, payment:update
report:read
```

### Default Admin Credentials

After running migrations:

- Email: `admin@loanplatform.com`
- Password: `Admin@123456`

⚠️ **Change these credentials immediately in production!**

## Event System

The platform uses RabbitMQ for event-driven architecture. Events are published for all critical actions:

### Event Types

- `user.registered`, `user.logged_in`, `user.logged_out`
- `loan_application.created`, `loan_application.submitted`, `loan_application.approved`, `loan_application.rejected`
- `credit_approval.created`
- `disbursement.created`, `disbursement.completed`, `disbursement.failed`
- `repayment.created`, `repayment.completed`

### Event Consumers

- **Audit Service**: Logs all events to audit trail
- **Email Service**: Sends notifications based on events

## Error Handling

All errors follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": null
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2025-02-05T10:30:00.000Z"
  }
}
```

### HTTP Status Codes

- `200 OK`: Successful GET/PUT
- `201 Created`: Resource created
- `202 Accepted`: Async processing started
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `409 Conflict`: State conflict, idempotency issue
- `422 Unprocessable Entity`: Business rule violation
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected error

## Logging

### Log Files

Located in `./logs/` directory:

- `application-YYYY-MM-DD.log`: General application logs
- `error-YYYY-MM-DD.log`: Error logs
- `audit-YYYY-MM-DD.log`: Audit trail (90-day retention)
- `security-YYYY-MM-DD.log`: Security events (90-day retention)

### Log Format

All logs are in JSON format with:

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (info, warn, error, debug)
- `message`: Log message
- `meta`: Additional context

## Testing

### Run All Tests

```bash
npm test
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Run Specific Test Suites

```bash
npm run test:unit
npm run test:integration
```

### Test Structure

- Unit tests: Test individual functions/methods
- Integration tests: Test module interactions
- API tests: Test HTTP endpoints

## Code Generation with Plop

Generate new modules quickly:

```bash
npm run plop module
```

This creates:

- Model
- Repository
- Service
- Controller
- Routes
- DTOs
- Test files

## Database Migrations

### Run Migrations

```bash
npm run migrate:up
```

### Rollback Migrations

```bash
npm run migrate:down
```

### Check Migration Status

```bash
npm run migrate:status
```

### Create New Migration

```bash
npm run migrate:create migration-name
```
