import './instrument';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import compression from 'compression';
import timeout from 'connect-timeout';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import { connectDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import householdRoutes from './routes/household.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';
import { startRecurringScheduler } from './scheduler/recurringExpenses';
import { startRecurringTaskScheduler } from './scheduler/recurringTasks';
import { startPendingExpenseScheduler } from './scheduler/pendingExpenses';
import { startRecurringShoppingItemScheduler } from './scheduler/recurringShoppingItems';
import { logger } from './utils/logger';

type RequestWithId = Request & { requestId?: string };

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust the first proxy hop (NGINX) so req.ip, express-rate-limit, and
// secure cookies reflect the real client behind the reverse proxy.
app.set('trust proxy', 1);

// ── Response compression (must run before other response-shaping middleware) ──
app.use(compression());

// ── Request ID + structured HTTP logging ──────────────────────────────
// Inject a requestId before pino-http so every log line carries it.
app.use((req, _res, next) => {
  (req as RequestWithId).requestId = crypto.randomUUID();
  next();
});
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as RequestWithId).requestId!,
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
  })
);

// ── Security middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cookieParser());

// ── CORS configuration ───────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// ── Request timeout (abort hung requests after 15s) ───────────────────
// Short-circuits any downstream middleware if the request already timed out.
const haltOnTimedout = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.timedout) next();
};
app.use(timeout('15s'));
app.use(haltOnTimedout);

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(haltOnTimedout);

// ── Rate limiting ─────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window per IP
  message: {
    status: 'error',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Rate limiting (general API) ───────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    status: 'error',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── API routes ────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/households', apiLimiter, householdRoutes);
app.use('/api/users', apiLimiter, userRoutes);

// ── Sentry error capture (must run before the custom error handler) ──
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ── Centralized error handler (must be last) ──────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDatabase();
    startRecurringScheduler();
    startRecurringTaskScheduler();
    startPendingExpenseScheduler();
    startRecurringShoppingItemScheduler();

    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🔐 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = (signal: string) => {
      logger.info(`[Server] ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await mongoose.connection.close();
          logger.info('[Server] Closed. Exiting.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, '[Server] Error during mongoose close');
          process.exit(1);
        }
      });

      // Force exit if shutdown takes longer than 10s
      setTimeout(() => {
        logger.error('[Server] Forced shutdown after 10s timeout.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

export default app;