const bcrypt = require('bcryptjs');

module.exports = {
  async up(db, client) {
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);

    await db.collection('users').insertOne({
      email: 'admin@loanplatform.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      permissions: [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'loan:create', 'loan:read', 'loan:update', 'loan:delete',
        'loan:approve', 'loan:reject', 'loan:disburse',
        'payment:create', 'payment:read', 'payment:update',
        'report:read',
      ],
      isActive: true,
      emailVerified: true,
      failedLoginAttempts: 0,
      refreshTokens: [],
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('Admin user created: admin@loanplatform.com / Admin@123456');
  },

  async down(db, client) {
    await db.collection('users').deleteOne({ email: 'admin@loanplatform.com' });
  }
};
