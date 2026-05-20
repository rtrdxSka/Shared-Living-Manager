import { vi } from 'vitest';

vi.mock('../../src/utils/logger', () => {
  const noop = vi.fn();
  // pino-http reads `logger.levels.values` and uses `logger[level]` to write,
  // so the mock must expose the same shape pino does.
  const logger: Record<string, unknown> = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    silent: noop,
    level: 'silent',
    levels: {
      values: {
        trace: 10,
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60,
      },
      labels: {
        10: 'trace',
        20: 'debug',
        30: 'info',
        40: 'warn',
        50: 'error',
        60: 'fatal',
      },
    },
  };
  logger.child = () => logger;
  return { logger, default: logger };
});
