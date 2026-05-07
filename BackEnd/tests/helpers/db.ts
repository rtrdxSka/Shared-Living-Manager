import mongoose from 'mongoose';

export const connectTestMongo = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — make sure dotenv loaded .env.test');
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, {
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
