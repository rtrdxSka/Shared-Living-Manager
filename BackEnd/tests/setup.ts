import { beforeAll, afterAll } from 'vitest';
import './mocks/email.mock';
import './mocks/logger.mock';
import { connectTestMongo, dropDatabase, disconnectMongoose } from './helpers/db';
import { seedDatabase } from './seed/seed';
import { setFixtures } from './seed/fixtures';

beforeAll(async () => {
  await connectTestMongo();
  await dropDatabase();
  const result = await seedDatabase();
  setFixtures(result);
}, 30_000);

afterAll(async () => {
  await disconnectMongoose();
});
