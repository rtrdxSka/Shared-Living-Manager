import { recurringShoppingItemService } from '../services/recurring-shopping-item.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

export function startRecurringShoppingItemScheduler(): void {
  // Daily at 06:00
  scheduleWithLock(
    '0 6 * * *',
    'recurring-shopping-daily',
    async () => {
      logger.info('[Scheduler] Firing daily recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('daily');
      logger.info({ result }, '[Scheduler] Daily recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  // Weekly on Mondays at 06:00
  scheduleWithLock(
    '0 6 * * 1',
    'recurring-shopping-weekly',
    async () => {
      logger.info('[Scheduler] Firing weekly recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
      logger.info({ result }, '[Scheduler] Weekly recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  // Monthly on the 1st at 06:00
  scheduleWithLock(
    '0 6 1 * *',
    'recurring-shopping-monthly',
    async () => {
      logger.info('[Scheduler] Firing monthly recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('monthly');
      logger.info({ result }, '[Scheduler] Monthly recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  logger.info('[Scheduler] Recurring shopping item scheduler started');
}
