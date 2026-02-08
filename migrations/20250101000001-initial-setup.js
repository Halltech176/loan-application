module.exports = {
  async up(db, client) {
    await db.createCollection('users');
    await db.createCollection('loanapplications');
    await db.createCollection('creditapprovals');
    await db.createCollection('disbursements');
    await db.createCollection('repayments');
    await db.createCollection('auditlogs');

    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('loanapplications').createIndex({ applicantId: 1, status: 1 });
    await db.collection('creditapprovals').createIndex({ loanApplicationId: 1 }, { unique: true });
    await db.collection('disbursements').createIndex({ loanApplicationId: 1 }, { unique: true });
    await db.collection('repayments').createIndex({ loanApplicationId: 1, status: 1 });
    await db.collection('auditlogs').createIndex({ eventId: 1 }, { unique: true });
    await db.collection('auditlogs').createIndex({ aggregateType: 1, aggregateId: 1 });

    console.log('Database collections and indexes created');
  },

  async down(db, client) {
    await db.collection('users').drop();
    await db.collection('loanapplications').drop();
    await db.collection('creditapprovals').drop();
    await db.collection('disbursements').drop();
    await db.collection('repayments').drop();
    await db.collection('auditlogs').drop();
  }
};
