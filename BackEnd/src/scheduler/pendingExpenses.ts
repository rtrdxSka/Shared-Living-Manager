import { expenseService } from '../services/expense.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startPendingExpenseScheduler(): void {
  // Run every hour — auto-confirm pending resolutions older than 48 hours
  scheduleWithLock(
    '0 * * * *',
    'pending-expenses-auto-confirm',
    async () => {
      logger.info('[Scheduler] Auto-confirming expired pending expense resolutions...');
      const count = await expenseService.autoConfirmExpiredPending();
      if (count > 0) {
        logger.info(`[Scheduler] Auto-confirm modified ${count} expense(s)`);
      }
    }
  );

  logger.info('[Scheduler] Pending expense scheduler started');
}
