import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: Number(process.env.MONGO_POOL_SIZE ?? 30),
      // Keep a minimum of 2 warm connections so the first request after
      // an idle period doesn't pay the TCP/TLS setup cost (~50ms).
      minPoolSize: 2,
      heartbeatFrequencyMS: 10000,
    });

    logger.info('✅ MongoDB connected successfully');
    logger.info(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    logger.error({ err: error }, '❌ MongoDB connection error');
    process.exit(1);
  }
};

// Graceful shutdown
mongoose.connection.on('disconnected', () => {
  logger.info('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  logger.error({ err: error }, '❌ MongoDB error');
});
