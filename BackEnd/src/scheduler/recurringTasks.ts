import { recurringTaskService } from '../services/recurring-task.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startRecurringTaskScheduler(): void {
  // Run at 00:06 on the 1st of every month — generate monthly instances
  // (staggered after the expense monthly job to avoid midnight thundering herd)
  scheduleWithLock(
    '6 0 1 * *',
    'recurring-tasks-monthly',
    async () => {
      logger.info('[Scheduler] Generating monthly recurring tasks...');
      await recurringTaskService.generateInstances('monthly');
    }
  );

  // Run at 00:04 every Monday — generate weekly instances
  scheduleWithLock(
    '4 0 * * 1',
    'recurring-tasks-weekly',
    async () => {
      logger.info('[Scheduler] Generating weekly recurring tasks...');
      await recurringTaskService.generateInstances('weekly');
    }
  );

  // Run at 00:01 every day — generate daily instances
  scheduleWithLock(
    '1 0 * * *',
    'recurring-tasks-daily',
    async () => {
      logger.info('[Scheduler] Generating daily recurring tasks...');
      await recurringTaskService.generateInstances('daily');
    }
  );

  logger.info('[Scheduler] Recurring task scheduler started');
}
