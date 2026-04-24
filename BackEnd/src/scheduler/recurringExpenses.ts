import cron from 'node-cron';
import { recurringExpenseService } from '../services/recurring-expense.service';
import { logger } from '../utils/logger';

export function startRecurringScheduler(): void {
  // Run at 00:05 on the 1st of every month — generate monthly instances
  // (staggered from other midnight jobs to avoid DB thundering herd)
  cron.schedule('5 0 1 * *', () => {
    logger.info('[Scheduler] Generating monthly recurring expenses...');
    recurringExpenseService.generateInstances('monthly').catch((err) => {
      logger.error({ err }, '[Scheduler] Error generating monthly instances');
    });
  });

  // Run at 00:03 every Monday — generate weekly instances
  cron.schedule('3 0 * * 1', () => {
    logger.info('[Scheduler] Generating weekly recurring expenses...');
    recurringExpenseService.generateInstances('weekly').catch((err) => {
      logger.error({ err }, '[Scheduler] Error generating weekly instances');
    });
  });

  logger.info('[Scheduler] Recurring expense scheduler started');
}
