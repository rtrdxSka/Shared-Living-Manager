import dotenv from 'dotenv';

dotenv.config();

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Required env var ${key} is not set`);
  }
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: process.env.PORT ?? '5000',
  MONGODB_URI: required('MONGODB_URI'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  SENTRY_DSN: process.env.SENTRY_DSN,
} as const;
