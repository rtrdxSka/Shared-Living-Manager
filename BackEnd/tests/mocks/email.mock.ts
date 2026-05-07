import { vi } from 'vitest';

vi.mock('../../src/utils/email', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));
