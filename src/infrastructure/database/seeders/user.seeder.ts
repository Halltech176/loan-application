import { getPermissionsForRole } from '@/data/permission';
import { Logger } from '@/infrastructure/logging/logger';
import { UserModel, UserRole, UserStatus } from '@/modules/user/user.model';
import { CustomerModel } from '@/modules/customer/customer.model';
import { generateCustomerData } from '@/data/csutomer.data';

const logger = Logger.getInstance();

export class UserSeeder {
  async seed(): Promise<void> {
    try {
      const existingUsers = await UserModel.countDocuments();
      if (existingUsers > 0) {
        logger.info('Users already exist, skipping user seeding');
        return;
      }

      const users = [
        {
          email: 'admin@loanplatform.com',
          password: 'Admin@123456',
          firstName: 'System',
          lastName: 'Administrator',
          phoneNumber: '+1234567890',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          permissions: getPermissionsForRole(UserRole.ADMIN),
          phoneVerified: true,
          emailVerified: true,
        },
        {
          email: 'officer@loanplatform.com',
          password: 'Officer@123456',
          firstName: 'John',
          lastName: 'Officer',
          phoneNumber: '+1234567891',
          role: UserRole.LOAN_OFFICER,
          status: UserStatus.ACTIVE,
          permissions: getPermissionsForRole(UserRole.LOAN_OFFICER),
          phoneVerified: true,
          emailVerified: true,
        },
        {
          email: 'customer1@example.com',
          password: 'Customer@123456',
          firstName: 'Alice',
          lastName: 'Johnson',
          phoneNumber: '+1234567892',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          permissions: getPermissionsForRole(UserRole.CUSTOMER),
          phoneVerified: true,
          emailVerified: true,
        },
        {
          email: 'customer2@example.com',
          password: 'Customer@123456',
          firstName: 'Bob',
          lastName: 'Smith',
          phoneNumber: '+1234567893',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          permissions: getPermissionsForRole(UserRole.CUSTOMER),
          phoneVerified: true,
          emailVerified: true,
        },
        {
          email: 'customer3@example.com',
          password: 'Customer@123456',
          firstName: 'Charlie',
          lastName: 'Brown',
          phoneNumber: '+1234567894',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          permissions: getPermissionsForRole(UserRole.CUSTOMER),
        },
        {
          email: 'suspended@example.com',
          password: 'Suspended@123456',
          firstName: 'David',
          lastName: 'Suspended',
          phoneNumber: '+1234567895',
          role: UserRole.CUSTOMER,
          status: UserStatus.SUSPENDED,
          permissions: getPermissionsForRole(UserRole.CUSTOMER),
          phoneVerified: true,
          emailVerified: true,
        },
      ];

      for (const userData of users) {
        const user = new UserModel(userData);
        await user.save();
        logger.info('User seeded', { email: user.email, role: user.role });

        if (user.role === UserRole.CUSTOMER) {
          const customerData = generateCustomerData(user._id as any);
          const customer = new CustomerModel(customerData);
          await customer.save();

          logger.info('Customer profile seeded', { userId: user._id });
        }
      }

      logger.info(`Successfully seeded ${users.length} users`);
    } catch (error) {
      logger.error('Failed to seed users', error as Error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await UserModel.deleteMany({});
      logger.info('Users cleared from database');
    } catch (error) {
      logger.error('Failed to clear users', error as Error);
      throw error;
    }
  }
}
