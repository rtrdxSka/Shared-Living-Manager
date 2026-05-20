/**
 * In-memory log of emails "sent" during a test run.
 *
 * Production code does NOT write to this — it is populated by the email mock
 * in `tests/mocks/email.mock.ts` (vitest) and by `src/utils/email.ts` when
 * `NODE_ENV === 'test'` (E2E). The `__test__` routes read from here.
 * Production builds never reach the writers because every call site is gated
 * on NODE_ENV.
 *
 * Keyed by recipient email; each entry records the kind of email queued
 * (`verify` / `reset` / `invite`) plus the rendered subject for ad-hoc
 * assertions. The raw verify / reset token (when present) is stashed in a
 * parallel map — the User document stores only the HASHED token, so tests
 * cannot read the raw value back from the DB. E2E callers need the raw
 * token to drive the public POST /auth/verify-email and /auth/reset-password
 * endpoints (which hash their input before comparing to the stored hash).
 */

export interface MailEnvelope {
  kind: 'verify' | 'reset' | 'invite';
  subject: string;
  sentAt: Date;
}

export const emailLog = new Map<string, MailEnvelope[]>();

export const recordEmail = (to: string, envelope: MailEnvelope): void => {
  const existing = emailLog.get(to) ?? [];
  existing.push(envelope);
  emailLog.set(to, existing);
};

export const clearEmailLog = (): void => {
  emailLog.clear();
};

// ── Raw-token stash (test-only) ───────────────────────────────────────
// Keyed by `${email}:${type}` so verify and reset don't collide. Writers
// (in src/utils/email.ts and tests/mocks/email.mock.ts) are gated on
// NODE_ENV === 'test'; production code never calls `recordRawToken`.

export type TokenType = 'verify' | 'reset';

const rawTokens = new Map<string, string>();

const key = (email: string, type: TokenType): string => `${email}:${type}`;

export const recordRawToken = (
  email: string,
  type: TokenType,
  token: string,
): void => {
  rawTokens.set(key(email, type), token);
};

export const getRawToken = (
  email: string,
  type: TokenType,
): string | undefined => {
  return rawTokens.get(key(email, type));
};

export const clearRawTokens = (): void => {
  rawTokens.clear();
};
