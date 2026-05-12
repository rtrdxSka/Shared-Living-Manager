import type { User } from '@/types/auth.types';

export const mockUser: User = {
  _id: 'user-test-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Example',
  households: [],
  preferences: {
    language: 'en',
    currency: 'USD',
    notifications: {
      email: true,
      push: false,
      frequency: 'instant',
    },
  },
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
