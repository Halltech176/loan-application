import { DatabaseConnection } from '../infrastructure/database/connection';
// import { RedisConnection } from '../infrastructure/cache/redis-connection';
// import { RabbitMQConnection } from '../infrastructure/messaging/rabbitmq-connection';

beforeAll(async () => {
  process.env.MONGODB_URI =
    process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/loan-platform-test';
  await DatabaseConnection.getInstance().connect();
});

afterAll(async () => {
  await DatabaseConnection.getInstance().disconnect();
});

afterEach(async () => {
  const db = DatabaseConnection.getInstance().getConnection();
  const collections = (await db.connection?.db?.collections()) ?? [];

  for (const collection of collections) {
    await collection.deleteMany({});
  }
});
