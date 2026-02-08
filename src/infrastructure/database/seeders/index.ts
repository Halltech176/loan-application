import { UserSeeder } from './user.seeder';
import { LoanSeeder } from './loan.seeder';
import { Logger } from '@/infrastructure/logging/logger';
import { DatabaseConnection } from '../connection';

export class DatabaseSeeder {
  private userSeeder: UserSeeder;
  private loanSeeder: LoanSeeder;
  private logger = Logger.getInstance();

  constructor() {
    this.userSeeder = new UserSeeder();
    this.loanSeeder = new LoanSeeder();
  }

  async seedAll(): Promise<void> {
    try {
      this.logger.info('Starting database seeding...');

      await this.userSeeder.seed();
      await this.loanSeeder.seed();

      this.logger.info('Database seeding completed successfully');
    } catch (error) {
      this.logger.error('Database seeding failed', error as Error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      this.logger.info('Starting database cleanup...');

      await this.loanSeeder.clear();
      await this.userSeeder.clear();

      this.logger.info('Database cleanup completed successfully');
    } catch (error) {
      this.logger.error('Database cleanup failed', error as Error);
      throw error;
    }
  }

  async reseed(): Promise<void> {
    await this.clearAll();
    await this.seedAll();
  }
}

async function runSeeder() {
  const logger = Logger.getInstance();

  try {
    const database = await DatabaseConnection.getInstance();

    await database.connect();
    logger.info('Database connected for seeding');

    const seeder = new DatabaseSeeder();

    const command = process.argv[2];

    switch (command) {
      case 'seed':
        await seeder.seedAll();
        break;
      case 'clear':
        await seeder.clearAll();
        break;
      case 'reseed':
        await seeder.reseed();
        break;
      default:
        logger.info('Usage: npm run seed [seed|clear|reseed]');
        logger.info('  seed   - Add seed data to database');
        logger.info('  clear  - Remove all seed data');
        logger.info('  reseed - Clear and re-add seed data');
    }

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Seeder execution failed', error as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeeder();
}

export default DatabaseSeeder;
