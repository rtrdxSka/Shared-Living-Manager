import { voteService } from '../services/vote.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

export function startAutoCloseVotesScheduler(): void {
  // Run at 00:10 every day — auto-close any open votes whose deadline has passed.
  // Staggered after recurring-task daily/weekly jobs (00:01 / 00:04 / 00:06) to
  // avoid a midnight thundering herd on the database.
  scheduleWithLock(
    '10 0 * * *',
    'auto-close-expired-votes',
    async () => {
      logger.info('[Scheduler] Auto-closing expired votes...');
      await voteService.autoCloseExpiredVotes();
    }
  );
  logger.info('[Scheduler] Auto-close-votes scheduler started');
}
