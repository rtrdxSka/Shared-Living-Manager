import { recurringExpenseService } from '../services/recurring-expense.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startRecurringScheduler(): void {
  // Run at 00:05 on the 1st of every month — generate monthly instances
  // (staggered from other midnight jobs to avoid DB thundering herd)
  scheduleWithLock(
    '5 0 1 * *',
    'recurring-expenses-monthly',
    async () => {
      logger.info('[Scheduler] Generating monthly recurring expenses...');
      await recurringExpenseService.generateInstances('monthly');
    }
  );

  // Run at 00:03 every Monday — generate weekly instances
  scheduleWithLock(
    '3 0 * * 1',
    'recurring-expenses-weekly',
    async () => {
      logger.info('[Scheduler] Generating weekly recurring expenses...');
      await recurringExpenseService.generateInstances('weekly');
    }
  );

  logger.info('[Scheduler] Recurring expense scheduler started');
}
