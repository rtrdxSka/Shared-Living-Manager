import mongoose from 'mongoose';

// Vitest assigns each pool worker (fork) a numeric VITEST_POOL_ID starting at 1.
// We append it to the DB name so parallel test files never share a DB and never
// race on dropDatabase()/seed(). When run outside Vitest (e.g. ad-hoc scripts),
// VITEST_POOL_ID is unset and we fall back to the URI's default DB.
const buildPerWorkerUri = (uri: string): string => {
  const poolId = process.env.VITEST_POOL_ID;
  if (!poolId) return uri;
  // mongodb://host:port/dbName  →  mongodb://host:port/dbName-<poolId>
  return uri.replace(/\/([^/?]+)(\?|$)/, `/$1-${poolId}$2`);
};

export const connectTestMongo = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — make sure dotenv loaded .env.test');
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(buildPerWorkerUri(uri), {
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 5000,
    maxPoolSize: 5,
  });
};

export const dropDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Cannot drop database: mongoose is not connected');
  }
  const dbName = mongoose.connection.name;
  if (!dbName.startsWith('slm-test')) {
    throw new Error(
      `Refusing to drop database "${dbName}" — only databases starting with "slm-test" can be dropped.`
    );
  }
  await mongoose.connection.dropDatabase();
};

export const disconnectMongoose = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
};
