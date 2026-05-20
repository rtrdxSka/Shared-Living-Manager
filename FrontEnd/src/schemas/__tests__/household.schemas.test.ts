import { describe, it, expect } from 'vitest';
import { joinHouseholdSchema } from '../household.schemas';

describe('joinHouseholdSchema', () => {
  it('accepts a UUID invite code', () => {
    expect(
      joinHouseholdSchema.safeParse({
        inviteCode: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });
  it('rejects an empty string', () => {
    expect(joinHouseholdSchema.safeParse({ inviteCode: '' }).success).toBe(false);
  });
  it('rejects a non-UUID format', () => {
    expect(joinHouseholdSchema.safeParse({ inviteCode: 'not-a-uuid' }).success).toBe(
      false,
    );
  });
  it('trims surrounding whitespace before validating', () => {
    const result = joinHouseholdSchema.safeParse({
      inviteCode: '   550e8400-e29b-41d4-a716-446655440000   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inviteCode).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });
});
