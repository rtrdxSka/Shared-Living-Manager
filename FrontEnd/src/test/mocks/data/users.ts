import type { User, AuthTokens } from '@/types/auth.types';

const basePreferences = {
  language: 'en',
  currency: 'EUR',
  notifications: { email: true, push: true, frequency: 'instant' as const },
} as const;

export const mockUsers = {
  alice: {
    _id: 'user-alice-001',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Anderson',
    households: ['hh-couple-001'],
    activeHousehold: 'hh-couple-001',
    preferences: basePreferences,
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  } satisfies User,

  bob: {
    _id: 'user-bob-001',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Baker',
    households: ['hh-couple-001'],
    activeHousehold: 'hh-couple-001',
    preferences: basePreferences,
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  } satisfies User,

  daveUnverified: {
    _id: 'user-dave-001',
    email: 'dave@example.com',
    firstName: 'Dave',
    lastName: 'Doe',
    households: ['hh-couple-001'],
    activeHousehold: 'hh-couple-001',
    preferences: basePreferences,
    isEmailVerified: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  } satisfies User,

  evaNoHousehold: {
    _id: 'user-eva-001',
    email: 'eva@example.com',
    firstName: 'Eva',
    lastName: 'Evans',
    households: [],
    preferences: basePreferences,
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  } satisfies User,
};

export const mockTokens: AuthTokens = { accessToken: 'test-access-token' };

// Backwards-compat re-export so any Batch 5 test that imports `mockUser` keeps working
export const mockUser = mockUsers.alice;
