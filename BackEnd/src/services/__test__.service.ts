import mongoose from 'mongoose';
import { Household } from '../models/household.model';
import { User } from '../models/user.model';
import { BadRequestError, NotFoundError } from '../utils/error';
import {
  clearRawTokens,
  emailLog,
  getRawToken,
} from '../utils/emailLog';

/**
 * Test-only utility service. The corresponding HTTP routes are mounted in
 * `src/index.ts` only when `NODE_ENV === 'test'`, so this service is
 * unreachable in production. Each method still performs a defensive check
 * (e.g. DB name must contain "test"/"e2e") in case the env var leaks.
 */
class TestUtilityService {
  /**
   * Drops every collection in the current database. Used by E2E `beforeEach`.
   * The conditional mount in index.ts already gates this behind NODE_ENV=test;
   * we add a belt-and-braces dbName check here so a misconfigured server can
   * never wipe production data.
   */
  async resetDatabase(): Promise<void> {
    const dbName = mongoose.connection.name;
    if (!/test|e2e/i.test(dbName)) {
      throw BadRequestError(
        `Refusing to reset database "${dbName}" — name must contain "test" or "e2e".`
      );
    }
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    emailLog.clear();
    clearRawTokens();
  }

  /**
   * Returns the latest verify or password-reset token for a user.
   *
   * The User document only stores a HASHED token (set by
   * authService.register / requestPasswordReset). The public verify and
   * reset endpoints expect the RAW token (they hash again before lookup),
   * so we capture the raw token in `emailLog`'s side-stash at send time
   * (`recordRawToken`, gated on NODE_ENV=test) and return it here.
   *
   * The presence check on the User document is retained so callers still
   * get a clean NotFoundError when the user simply doesn't exist or the
   * server has restarted between register and getLastToken.
   */
  async getLastToken(email: string, type: 'verify' | 'reset'): Promise<string> {
    const user = await User.findOne({ email })
      .select('+emailVerificationToken +passwordResetToken')
      .lean();
    if (!user) throw NotFoundError(`No user with email ${email}`);
    const hashed = type === 'verify' ? user.emailVerificationToken : user.passwordResetToken;
    if (!hashed) throw NotFoundError(`No ${type} token for ${email}`);

    const raw = getRawToken(email, type);
    if (!raw) {
      throw NotFoundError(
        `No raw ${type} token captured for ${email} — was sendVerificationEmail / sendPasswordResetEmail invoked in this process?`,
      );
    }
    return raw;
  }

  /**
   * Returns booleans indicating whether the mock email service queued a
   * verify/reset email for this user. The mock email service writes to
   * `src/utils/emailLog.ts`; we read it here.
   */
  async getEmailStatus(
    email: string
  ): Promise<{ verifyEmailSent: boolean; resetEmailSent: boolean }> {
    const entries = emailLog.get(email) ?? [];
    return {
      verifyEmailSent: entries.some((e) => e.kind === 'verify'),
      resetEmailSent: entries.some((e) => e.kind === 'reset'),
    };
  }

  /**
   * Backdates a household's taskRotationConfig.startedAt by `daysBack` days,
   * so the next rotation period boundary is crossed without sleeping in tests.
   */
  async fastForwardRotation(householdId: string, daysBack: number): Promise<void> {
    const newStart = new Date(Date.now() - daysBack * 86400_000);
    const result = await Household.updateOne(
      { _id: householdId },
      { $set: { 'settings.taskRotationConfig.startedAt': newStart } }
    );
    if (result.matchedCount === 0) throw NotFoundError(`Household ${householdId} not found`);
  }
}

export const testUtilityService = new TestUtilityService();
