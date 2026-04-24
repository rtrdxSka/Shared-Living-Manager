import cron from 'node-cron';
import { recurringTaskService } from '../services/recurring-task.service';
import { logger } from '../utils/logger';

export function startRecurringTaskScheduler(): void {
  // Run at 00:06 on the 1st of every month — generate monthly instances
  // (staggered after the expense monthly job to avoid midnight thundering herd)
  cron.schedule('6 0 1 * *', () => {
    logger.info('[Scheduler] Generating monthly recurring tasks...');
    recurringTaskService.generateInstances('monthly').catch((err) => {
      logger.error({ err }, '[Scheduler] Error generating monthly task instances');
    });
  });

  // Run at 00:04 every Monday — generate weekly instances
  cron.schedule('4 0 * * 1', () => {
    logger.info('[Scheduler] Generating weekly recurring tasks...');
    recurringTaskService.generateInstances('weekly').catch((err) => {
      logger.error({ err }, '[Scheduler] Error generating weekly task instances');
    });
  });

  // Run at 00:01 every day — generate daily instances
  cron.schedule('1 0 * * *', () => {
    logger.info('[Scheduler] Generating daily recurring tasks...');
    recurringTaskService.generateInstances('daily').catch((err) => {
      logger.error({ err }, '[Scheduler] Error generating daily task instances');
    });
  });

  logger.info('[Scheduler] Recurring task scheduler started');
}
