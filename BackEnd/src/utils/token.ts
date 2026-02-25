import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token (64-char hex string).
 */
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token using SHA-256.
 * Fast hash is appropriate for high-entropy random tokens (unlike passwords).
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Compare a plain token against a SHA-256 hash using timing-safe comparison.
 */
export const compareToken = (plain: string, hashed: string): boolean => {
  const plainHash = hashToken(plain);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(plainHash, 'hex'),
      Buffer.from(hashed, 'hex')
    );
  } catch {
    return false;
  }
};
