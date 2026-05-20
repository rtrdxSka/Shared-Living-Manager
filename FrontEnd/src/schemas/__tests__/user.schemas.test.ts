import { describe, it, expect } from 'vitest';
import {
  profileSchema,
  createProfileSchema,
  changePasswordSchema,
} from '../user.schemas';

describe('profileSchema', () => {
  it('accepts valid input without password', () => {
    expect(
      profileSchema.safeParse({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'a@b.co',
      }).success,
    ).toBe(true);
  });
  it('rejects firstName under 2 characters', () => {
    expect(
      profileSchema.safeParse({
        firstName: 'A',
        lastName: 'Anderson',
        email: 'a@b.co',
      }).success,
    ).toBe(false);
  });
});

describe('createProfileSchema', () => {
  it('email unchanged → password not required', () => {
    const schema = createProfileSchema('alice@b.co');
    expect(
      schema.safeParse({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@b.co',
      }).success,
    ).toBe(true);
  });

  it('email changed without currentPassword → rejected', () => {
    const schema = createProfileSchema('alice@b.co');
    expect(
      schema.safeParse({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'new@b.co',
      }).success,
    ).toBe(false);
  });

  it('email changed with currentPassword → accepted', () => {
    const schema = createProfileSchema('alice@b.co');
    expect(
      schema.safeParse({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'new@b.co',
        currentPassword: 'Pw',
      }).success,
    ).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'Password123!',
        confirmNewPassword: 'Password123!',
      }).success,
    ).toBe(true);
  });
  it('rejects mismatched confirm', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'Password123!',
        confirmNewPassword: 'Different1!',
      }).success,
    ).toBe(false);
  });
  it('rejects weak new password (too short)', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'weak',
        confirmNewPassword: 'weak',
      }).success,
    ).toBe(false);
  });
});
