import cron from 'node-cron';
import { recurringTaskService } from '../services/recurring-task.service';

export function startRecurringTaskScheduler(): void {
  // Run at 00:01 on the 1st of every month — generate monthly instances
  cron.schedule('1 0 1 * *', () => {
    console.log('[Scheduler] Generating monthly recurring tasks...');
    recurringTaskService.generateInstances('monthly').catch((err) => {
      console.error('[Scheduler] Error generating monthly task instances:', err);
    });
  });

  // Run at 00:01 every Monday — generate weekly instances
  cron.schedule('1 0 * * 1', () => {
    console.log('[Scheduler] Generating weekly recurring tasks...');
    recurringTaskService.generateInstances('weekly').catch((err) => {
      console.error('[Scheduler] Error generating weekly task instances:', err);
    });
  });

  console.log('[Scheduler] Recurring task scheduler started');
}
