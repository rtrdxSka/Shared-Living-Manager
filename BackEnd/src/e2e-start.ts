import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import app from './index';
import { logger } from './utils/logger';

// Load .env.test from the e2e workspace if present; otherwise BackEnd/.env.test.
// We resolve relative to process.cwd() to remain compatible with both CJS
// (__dirname) and ESM (import.meta.url) execution contexts under tsx.
// The script is expected to be launched from the BackEnd workspace, so the
// default resolves to <repo-root>/.env.test, matching the docs in the plan.
const envPath = process.env.E2E_ENV_PATH ?? path.resolve(process.cwd(), '../.env.test');
dotenv.config({ path: envPath });

const PORT = Number(process.env.PORT) || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[E2E] MONGODB_URI is required');
  process.exit(1);
}

async function start() {
  await mongoose.connect(MONGODB_URI!);
  logger.info('[E2E] Connected to MongoDB');

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[E2E] Server running on port ${PORT}`);
    logger.info(`[E2E] NODE_ENV=${process.env.NODE_ENV}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`[E2E] ${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[E2E] Failed to start:', err);
  process.exit(1);
});
