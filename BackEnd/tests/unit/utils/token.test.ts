import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { generateToken, hashToken } from '../../../src/utils/token';

describe('token utilities', () => {
  it('generateToken returns a 64-char lowercase hex string (32 random bytes)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generateToken produces unique values across calls', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('hashToken is deterministic for the same input', () => {
    expect(hashToken('abcd1234')).toBe(hashToken('abcd1234'));
  });

  it('hashToken returns a 64-char lowercase hex string (SHA-256 digest)', () => {
    expect(hashToken('hello')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashToken matches a known SHA-256 vector', () => {
    const expected = crypto.createHash('sha256').update('hello').digest('hex');
    expect(hashToken('hello')).toBe(expected);
  });

  it('hashToken differs for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
