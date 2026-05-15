import { vi } from 'vitest';
import { recordEmail } from '../../src/utils/emailLog';

vi.mock('../../src/utils/email', () => ({
  sendVerificationEmail: vi.fn(async (to: string) => {
    recordEmail(to, {
      kind: 'verify',
      subject: 'Verify your email address',
      sentAt: new Date(),
    });
  }),
  sendPasswordResetEmail: vi.fn(async (to: string) => {
    recordEmail(to, {
      kind: 'reset',
      subject: 'Reset your password',
      sentAt: new Date(),
    });
  }),
  sendHouseholdInvitationEmail: vi.fn(async (to: string) => {
    recordEmail(to, {
      kind: 'invite',
      subject: 'Household invitation',
      sentAt: new Date(),
    });
  }),
}));
