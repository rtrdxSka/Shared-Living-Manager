import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../auth.schemas';

describe('loginSchema', () => {
  it('accepts valid input', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: 'Password123!' }).success,
    ).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(
      loginSchema.safeParse({ email: 'not-email', password: 'Password123!' }).success,
    ).toBe(false);
  });
  it('rejects short password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(
      false,
    );
  });
});

describe('registerSchema', () => {
  const good = {
    firstName: 'Alice',
    lastName: 'Anderson',
    email: 'a@b.co',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  it('accepts valid registration', () => {
    expect(registerSchema.safeParse(good).success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    expect(
      registerSchema.safeParse({ ...good, confirmPassword: 'Different1!' }).success,
    ).toBe(false);
  });
  it('rejects password without uppercase', () => {
    expect(
      registerSchema.safeParse({
        ...good,
        password: 'password1!',
        confirmPassword: 'password1!',
      }).success,
    ).toBe(false);
  });
  it('rejects password without lowercase', () => {
    expect(
      registerSchema.safeParse({
        ...good,
        password: 'PASSWORD1!',
        confirmPassword: 'PASSWORD1!',
      }).success,
    ).toBe(false);
  });
  it('rejects password without digit', () => {
    expect(
      registerSchema.safeParse({
        ...good,
        password: 'Password!',
        confirmPassword: 'Password!',
      }).success,
    ).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching strong passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }).success,
    ).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Password123!',
        confirmPassword: 'Different1!',
      }).success,
    ).toBe(false);
  });
  it('rejects weak password (no digit)', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Password!',
        confirmPassword: 'Password!',
      }).success,
    ).toBe(false);
  });
});
