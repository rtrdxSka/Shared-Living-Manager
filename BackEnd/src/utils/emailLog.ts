/**
 * In-memory log of emails "sent" during a test run.
 *
 * Production code does NOT write to this — it is populated by the email mock
 * in `tests/mocks/email.mock.ts` and inspected by the `__test__` routes
 * (`getEmailStatus`). Both live behind `NODE_ENV === 'test'` so production
 * builds never reach this code path.
 *
 * Keyed by recipient email; each entry records the kind of email queued
 * (`verify` or `reset`) plus the rendered subject for ad-hoc assertions.
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
