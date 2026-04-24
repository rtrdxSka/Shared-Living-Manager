import cron from 'node-cron';
import { expenseService } from '../services/expense.service';
import { logger } from '../utils/logger';

export function startPendingExpenseScheduler(): void {
  // Run every hour — auto-confirm pending resolutions older than 48 hours
  cron.schedule('0 * * * *', () => {
    logger.info('[Scheduler] Auto-confirming expired pending expense resolutions...');
    expenseService.autoConfirmExpiredPending().then((count) => {
      if (count > 0) logger.info(`[Scheduler] Auto-confirmed ${count} pending expense(s)`);
    }).catch((err) => {
      logger.error({ err }, '[Scheduler] Error auto-confirming pending expenses');
    });
  });

  logger.info('[Scheduler] Pending expense scheduler started');
}
