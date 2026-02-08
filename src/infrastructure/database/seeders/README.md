# Database Seeders

This directory contains database seeders for development and testing purposes.

## What Are Seeders?

Seeders populate your database with initial/sample data so you can:
- Test the application with realistic data
- Develop features without manually creating data
- Demo the application
- Run automated tests with consistent data

## Available Seeders

### 1. User Seeder (`user.seeder.ts`)
Creates sample users with different roles:
- **Admin** - System administrator
- **Loan Officer** - Can approve/reject loans
- **Customers** - Regular users who apply for loans
- **Suspended User** - For testing account status

**Default Users Created:**
| Email | Password | Role | Status |
|-------|----------|------|--------|
| admin@loanplatform.com | Admin@123456 | ADMIN | ACTIVE |
| officer@loanplatform.com | Officer@123456 | LOAN_OFFICER | ACTIVE |
| customer1@example.com | Customer@123456 | CUSTOMER | ACTIVE |
| customer2@example.com | Customer@123456 | CUSTOMER | ACTIVE |
| customer3@example.com | Customer@123456 | CUSTOMER | ACTIVE |
| suspended@example.com | Suspended@123456 | CUSTOMER | SUSPENDED |

### 2. Loan Seeder (`loan.seeder.ts`)
Creates sample loans in different states:
- **Pending** - Just submitted, awaiting review
- **Under Review** - Being evaluated
- **Approved** - Approved but not yet disbursed
- **Rejected** - Application denied
- **Disbursed** - Money sent to customer
- **Active** - Customer making repayments
- **Closed** - Fully repaid (not in initial seed)

**Sample Loans:**
- Business expansion loan (pending)
- Home renovation loan (approved)
- Tech startup loan (under review)
- Education loan (disbursed)
- Home improvement loan (rejected)
- Debt consolidation loan (active with partial repayment)

## Usage

### Run All Seeders
```bash
npm run seed
```

### Clear All Seed Data
```bash
npm run seed:clear
```

### Re-seed (Clear and Seed Again)
```bash
npm run seed:reseed
```

## How It Works

1. **Check for Existing Data**: Seeders check if data already exists to avoid duplicates
2. **Create Data**: Insert sample records
3. **Log Progress**: All operations are logged
4. **Handle Errors**: Gracefully handle any failures

## Development Workflow

### First Time Setup
```bash
# 1. Start database
docker-compose up -d mongodb

# 2. Run seeders
npm run seed

# 3. Start application
npm run dev

# 4. Login with seeded users
# Use any email/password from the table above
```

### Reset Database
```bash
# Clear and re-seed (useful when you mess up data during testing)
npm run seed:reseed
```

### Testing
```bash
# Clear before tests
npm run seed:clear

# Run tests (they may have their own test data)
npm test
```

## Creating New Seeders

To add a new seeder (e.g., for payments):

1. **Create the seeder file** (`src/database/seeders/payment.seeder.ts`):
```typescript
import { Payment } from '../../modules/payment/domain/payment.model';
import { Logger } from '../../infrastructure/logger';

export class PaymentSeeder {
  async seed(): Promise<void> {
    // Check if data exists
    const count = await Payment.countDocuments();
    if (count > 0) {
      Logger.info('Payments already exist, skipping');
      return;
    }

    // Create sample data
    const payments = [
      { loanId: '...', amount: 1000, ... },
      { loanId: '...', amount: 2000, ... },
    ];

    for (const data of payments) {
      await Payment.create(data);
    }

    Logger.info(`Seeded ${payments.length} payments`);
  }

  async clear(): Promise<void> {
    await Payment.deleteMany({});
    Logger.info('Payments cleared');
  }
}
```

2. **Add to main seeder** (`src/database/seeders/index.ts`):
```typescript
import { PaymentSeeder } from './payment.seeder';

// In DatabaseSeeder class
constructor() {
  this.userSeeder = new UserSeeder();
  this.loanSeeder = new LoanSeeder();
  this.paymentSeeder = new PaymentSeeder(); // Add this
}

async seedAll(): Promise<void> {
  await this.userSeeder.seed();
  await this.loanSeeder.seed();
  await this.paymentSeeder.seed(); // Add this
}

async clearAll(): Promise<void> {
  await this.paymentSeeder.clear(); // Add this (order matters!)
  await this.loanSeeder.clear();
  await this.userSeeder.clear();
}
```

## Order Matters!

When seeding:
1. **Seed in dependency order**: Users → Loans → Payments
   (Users must exist before creating loans)

When clearing:
2. **Clear in reverse order**: Payments → Loans → Users
   (Delete dependent records first)

## Environment-Specific Seeding

Seeders should only run in:
- ✅ Development environment
- ✅ Testing environment
- ❌ **NEVER in production!**

The seeder checks `NODE_ENV` to prevent accidental production seeding:

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('Cannot run seeders in production!');
}
```

## Best Practices

1. **Idempotent Seeders**: Running multiple times shouldn't create duplicates
2. **Realistic Data**: Use realistic amounts, dates, and descriptions
3. **Various States**: Include records in different states for testing
4. **Edge Cases**: Include edge cases (rejected loans, suspended users)
5. **Relationships**: Ensure foreign keys reference existing records
6. **Logging**: Log what's being created for debugging
7. **Error Handling**: Handle failures gracefully

## Troubleshooting

### "Users already exist"
```bash
# Clear first, then seed
npm run seed:reseed
```

### "No customers found for loans"
```bash
# Make sure users are seeded first
npm run seed:clear
npm run seed
```

### Seeder fails midway
```bash
# Check logs for errors
# Clear and try again
npm run seed:clear
npm run seed
```

## Sample API Calls After Seeding

Once seeded, you can test the API:

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@loanplatform.com","password":"Admin@123456"}'

# Login as loan officer
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"officer@loanplatform.com","password":"Officer@123456"}'

# Login as customer
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@example.com","password":"Customer@123456"}'
```

## Notes

- Passwords are hashed using bcrypt (same as production)
- All timestamps use realistic dates
- Loan calculations are accurate
- Decision history is properly tracked
- Seeders are safe to run multiple times
