import { beforeAll, afterAll, vi } from 'vitest';
import './mocks/email.mock';
import './mocks/logger.mock';
import { connectTestMongo, dropDatabase, disconnectMongoose } from './helpers/db';
import { seedDatabase } from './seed/seed';
import { setFixtures } from './seed/fixtures';

vi.mock('express-rate-limit', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

beforeAll(async () => {
  await connectTestMongo();
  await dropDatabase();
  const result = await seedDatabase();
  setFixtures(result);
}, 30_000);

afterAll(async () => {
  await disconnectMongoose();
});
