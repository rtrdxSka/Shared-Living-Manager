import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// IMPORTANT: tests/setup.ts globally mocks src/utils/email via tests/mocks/email.mock.ts.
// Bypass that here so we can test the REAL module against a mocked `resend` package.
vi.unmock('../../../src/utils/email');

// Mock the underlying resend package. The factory is hoisted, so `mockSend`
// has to be declared with vi.hoisted to be referenceable inside vi.mock(...).
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ id: 'msg_123' });
  vi.resetModules();
  // email.ts short-circuits to an in-memory stash when NODE_ENV=test (so
  // E2E specs can capture the raw verify/reset token without talking to
  // Resend). These unit tests intentionally exercise the REAL Resend path,
  // so we drop into production-mode for the duration of each test.
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('sendVerificationEmail', () => {
  it('calls resend.emails.send with the right shape', async () => {
    const { sendVerificationEmail } = await import('../../../src/utils/email');
    await sendVerificationEmail('user@example.com', 'Alice', 'tok123');

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toMatch(/HouseMate <.+>/);
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toBe('Verify your email address');
    expect(args.html).toContain('http://localhost:5173/verify-email?token=tok123');
    expect(args.html).toContain('Alice');
  });

  it('HTML-escapes firstName (XSS regression)', async () => {
    const { sendVerificationEmail } = await import('../../../src/utils/email');
    await sendVerificationEmail('user@example.com', '<script>alert(1)</script>', 'tok');

    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('rejects when Resend rejects', async () => {
    mockSend.mockRejectedValueOnce(new Error('resend boom'));
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow('resend boom');
  });

  it('rejects with timeout when send takes longer than RESEND_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    mockSend.mockImplementationOnce(() => new Promise(() => { /* hang forever */ }));
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    const promise = sendVerificationEmail('a@b.co', 'A', 't');
    vi.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('Resend request timed out');
  });

  it('throws if RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow(
      /RESEND_API_KEY is not defined/
    );
  });

  it('throws if FROM_EMAIL is unset', async () => {
    vi.stubEnv('FROM_EMAIL', '');
    const { sendVerificationEmail } = await import('../../../src/utils/email');

    await expect(sendVerificationEmail('a@b.co', 'A', 't')).rejects.toThrow(
      /FROM_EMAIL is not defined/
    );
  });
});

describe('sendPasswordResetEmail', () => {
  it('uses the reset URL and reset subject', async () => {
    const { sendPasswordResetEmail } = await import('../../../src/utils/email');
    await sendPasswordResetEmail('user@example.com', 'Alice', 'reset-tok');

    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toBe('Reset your password');
    expect(args.html).toContain('http://localhost:5173/reset-password?token=reset-tok');
  });
});
