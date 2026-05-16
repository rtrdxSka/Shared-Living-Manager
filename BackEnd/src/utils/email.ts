import { Resend } from 'resend';
import { recordEmail, recordRawToken } from './emailLog';

const RESEND_TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS ?? 5000);

async function sendWithTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Resend request timed out')), RESEND_TIMEOUT_MS)
    ),
  ]);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

let resendClient: Resend | null = null;

const getResendClient = (): Resend => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

const getFromEmail = (): string => {
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error('FROM_EMAIL is not defined in environment variables');
  }
  return from;
};

const getFrontendUrl = (): string => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

export const sendVerificationEmail = async (
  to: string,
  firstName: string,
  token: string
): Promise<void> => {
  // E2E stash: capture the raw token before Resend is invoked, so the
  // /api/__test__/last-token endpoint can hand it back to a Playwright
  // spec. The User document only stores the hashed token, so without this
  // stash the raw token is unrecoverable. Gated on NODE_ENV so the
  // production server never builds up an unbounded map.
  if (process.env.NODE_ENV === 'test') {
    recordRawToken(to, 'verify', token);
    recordEmail(to, {
      kind: 'verify',
      subject: 'Verify your email address',
      sentAt: new Date(),
    });
    return;
  }

  const resend = getResendClient();
  const verificationUrl = `${getFrontendUrl()}/verify-email?token=${token}`;

  await sendWithTimeout(resend.emails.send({
    from: `HouseMate <${getFromEmail()}>`,
    to,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #27272a;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Verify your email</h2>
        <p style="font-size: 14px; color: #52525b; margin: 0 0 24px;">
          Hi ${escapeHtml(firstName)}, please verify your email address to complete your registration.
        </p>
        <a href="${verificationUrl}" style="display: inline-block; background: #18181b; color: #fafafa; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Verify Email
        </a>
        <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
          This link expires in 30 days. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  }));
};

export const sendHouseholdInvitationEmail = async (
  to: string,
  inviterFirstName: string,
  householdName: string,
  inviteCode: string,
  expiresAt: Date,
  personalNote?: string
): Promise<void> => {
  const resend = getResendClient();
  const joinUrl = `${getFrontendUrl()}/get-started?invite=${encodeURIComponent(inviteCode)}`;
  const expiresLabel = expiresAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const personalNoteHtml = personalNote
    ? `<p style="font-size: 14px; color: #52525b; margin: 0 0 24px; padding: 12px 16px; background: #f4f4f5; border-left: 3px solid #18181b;">${escapeHtml(personalNote)}</p>`
    : '';

  await sendWithTimeout(resend.emails.send({
    from: `HouseMate <${getFromEmail()}>`,
    to,
    subject: `${escapeHtml(inviterFirstName)} invited you to join ${escapeHtml(householdName)}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #27272a;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Join ${escapeHtml(householdName)}</h2>
        <p style="font-size: 14px; color: #52525b; margin: 0 0 24px;">
          ${escapeHtml(inviterFirstName)} invited you to join their household on HouseMate.
        </p>
        ${personalNoteHtml}
        <a href="${joinUrl}" style="display: inline-block; background: #18181b; color: #fafafa; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Join Household
        </a>
        <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
          Or paste this code on the Join screen: <strong>${escapeHtml(inviteCode)}</strong>
        </p>
        <p style="font-size: 12px; color: #a1a1aa; margin: 8px 0 0;">
          This invite expires on ${expiresLabel}.
        </p>
      </div>
    `,
  }));
};

export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  token: string
): Promise<void> => {
  // See sendVerificationEmail above — same E2E stash pattern.
  if (process.env.NODE_ENV === 'test') {
    recordRawToken(to, 'reset', token);
    recordEmail(to, {
      kind: 'reset',
      subject: 'Reset your password',
      sentAt: new Date(),
    });
    return;
  }

  const resend = getResendClient();
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;

  await sendWithTimeout(resend.emails.send({
    from: `HouseMate <${getFromEmail()}>`,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #27272a;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Reset your password</h2>
        <p style="font-size: 14px; color: #52525b; margin: 0 0 24px;">
          Hi ${escapeHtml(firstName)}, we received a request to reset your password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #18181b; color: #fafafa; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  }));
};
