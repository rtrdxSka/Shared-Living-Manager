import cron from 'node-cron';
import { expenseService } from '../services/expense.service';

export function startPendingExpenseScheduler(): void {
  // Run every hour — auto-confirm pending resolutions older than 48 hours
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Auto-confirming expired pending expense resolutions...');
    expenseService.autoConfirmExpiredPending().then((count) => {
      if (count > 0) console.log(`[Scheduler] Auto-confirmed ${count} pending expense(s)`);
    }).catch((err) => {
      console.error('[Scheduler] Error auto-confirming pending expenses:', err);
    });
  });

  console.log('[Scheduler] Pending expense scheduler started');
}
