import cron from 'node-cron';
import { recurringExpenseService } from '../services/recurring-expense.service';

export function startRecurringScheduler(): void {
  // Run at 00:01 on the 1st of every month — generate monthly instances
  cron.schedule('1 0 1 * *', () => {
    console.log('[Scheduler] Generating monthly recurring expenses...');
    recurringExpenseService.generateInstances('monthly').catch((err) => {
      console.error('[Scheduler] Error generating monthly instances:', err);
    });
  });

  // Run at 00:01 every Monday — generate weekly instances
  cron.schedule('1 0 * * 1', () => {
    console.log('[Scheduler] Generating weekly recurring expenses...');
    recurringExpenseService.generateInstances('weekly').catch((err) => {
      console.error('[Scheduler] Error generating weekly instances:', err);
    });
  });

  console.log('[Scheduler] Recurring expense scheduler started');
}
