import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { authService } from '../../../src/services/auth.service';
import { User } from '../../../src/models/user.model';
import { RefreshToken } from '../../../src/models/refresh-token.model';
import { hashToken } from '../../../src/utils/token';
import { AppError } from '../../../src/utils/error';
import * as emailMod from '../../../src/utils/email';
import { FIXTURES } from '../../seed/fixtures';

// Opaque refresh tokens are 32 random bytes encoded as hex (64 chars, lower-case).
const REFRESH_TOKEN_RE = /^[a-f0-9]{64}$/;

// ── Helpers ──────────────────────────────────────────────────────────
// `NotFoundError`, `BadRequestError`, etc. are arrow-function factories — not classes.
// We can't use `instanceof` on them. Match against AppError + statusCode instead.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

describe('authService.register', () => {
  beforeEach(() => {
    vi.mocked(emailMod.sendVerificationEmail).mockClear();
  });

  it('creates a new user, hashes password, returns tokens', async () => {
    const result = await authService.register({
      email: 'newuser-register@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
    });

    expect(result.user.email).toBe('newuser-register@example.com');
    expect(result.tokens.accessToken).toBeTypeOf('string');
    // Opaque token: 64 hex chars (32 random bytes), not a JWT.
    expect(result.tokens.refreshToken).toMatch(REFRESH_TOKEN_RE);

    const stored = await User.findById(result.user._id).select('+password').lean();
    expect(stored?.password.startsWith('$2')).toBe(true); // bcrypt prefix

    // A RefreshToken doc should exist with the matching hash.
    const rtDoc = await RefreshToken.findOne({
      tokenHash: hashToken(result.tokens.refreshToken),
    }).lean();
    expect(rtDoc).not.toBeNull();
    expect(rtDoc!.userId.toString()).toBe(result.user._id);
    expect(rtDoc!.revokedAt).toBeFalsy();
    expect(rtDoc!.replacedBy).toBeFalsy();

    // F1.5 — fire-and-forget verification email is dispatched on register.
    expect(emailMod.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('sends verification email on register', async () => {
    await authService.register({
      email: 'verify-register@example.com',
      password: 'Password123!',
      firstName: 'V',
      lastName: 'X',
    });
    expect(emailMod.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('throws ConflictError (409) when email already exists', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      authService.register({
        email: alice.email,
        password: 'Password123!',
        firstName: 'X',
        lastName: 'Y',
      }),
    ).rejects.toSatisfy(expectAppError(409));
  });
});

describe('authService.login', () => {
  it('returns user + tokens for valid credentials', async () => {
    const bob = FIXTURES.user('bob');
    const result = await authService.login({ email: bob.email, password: bob.password });
    expect(result.user._id).toBe(bob._id.toString());
    expect(result.tokens.accessToken).toBeTypeOf('string');
    // Opaque token: 64 hex chars (32 random bytes), not a JWT.
    expect(result.tokens.refreshToken).toMatch(REFRESH_TOKEN_RE);

    // RefreshToken doc inserted in DB with matching hash.
    const rtDoc = await RefreshToken.findOne({
      tokenHash: hashToken(result.tokens.refreshToken),
    }).lean();
    expect(rtDoc).not.toBeNull();
    expect(rtDoc!.userId.toString()).toBe(bob._id.toString());
  });

  it('throws UnauthorizedError (401) on wrong password', async () => {
    const bob = FIXTURES.user('bob');
    await expect(
      authService.login({ email: bob.email, password: 'WrongPassword!' }),
    ).rejects.toSatisfy(expectAppError(401));
  });

  it('throws UnauthorizedError (401) on unknown email', async () => {
    await expect(
      authService.login({ email: 'nobody-login@example.com', password: 'Whatever1!' }),
    ).rejects.toSatisfy(expectAppError(401));
  });
});

describe('authService.refreshToken', () => {
  it('returns a new token pair when refresh token is valid (rotation)', async () => {
    const carol = FIXTURES.user('carol');
    const initial = await authService.login({ email: carol.email, password: carol.password });
    const refreshed = await authService.refreshToken(initial.tokens.refreshToken);
    expect(refreshed.accessToken).toBeTypeOf('string');
    expect(refreshed.refreshToken).toMatch(REFRESH_TOKEN_RE);
    expect(refreshed.refreshToken).not.toBe(initial.tokens.refreshToken);

    // Old token doc should now have replacedBy pointing at the new doc.
    const oldDoc = await RefreshToken.findOne({
      tokenHash: hashToken(initial.tokens.refreshToken),
    }).lean();
    expect(oldDoc).not.toBeNull();
    expect(oldDoc!.replacedBy).toBeTruthy();
  });

  it('throws UnauthorizedError (401) when refresh token is malformed', async () => {
    await expect(authService.refreshToken('not-a-jwt')).rejects.toSatisfy(expectAppError(401));
  });

  it('throws UnauthorizedError (401) when an already-rotated token is reused; revokes ALL sessions for that user (theft detection)', async () => {
    const eve = FIXTURES.user('eve');
    // Issue rt-A, rotate it to get rt-B, then re-use rt-A — that's the theft signal.
    const a = await authService.login({ email: eve.email, password: eve.password });
    await authService.refreshToken(a.tokens.refreshToken); // rotate → rt-B
    await expect(authService.refreshToken(a.tokens.refreshToken)).rejects.toSatisfy(
      expectAppError(401),
    );
    // Panic response: every refresh token for eve should now be revoked.
    const docs = await RefreshToken.find({ userId: eve._id }).lean();
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect(d.revokedAt).toBeTruthy();
    }
  });
});

describe('authService — multi-device sessions', () => {
  it('isolates per-device sessions (rotating/logout on one device does not affect others)', async () => {
    // Use a fresh user so the seeded fixtures aren't disturbed.
    const u = await User.create({
      email: 'multi-device@example.com',
      password: 'Password123!',
      firstName: 'Multi',
      lastName: 'Device',
    });

    const sessionA = await authService.login(
      { email: 'multi-device@example.com', password: 'Password123!' },
      { userAgent: 'device-A' },
    );
    const sessionB = await authService.login(
      { email: 'multi-device@example.com', password: 'Password123!' },
      { userAgent: 'device-B' },
    );

    // Two active RT docs: one per device.
    const initialDocs = await RefreshToken.find({ userId: u._id, revokedAt: null }).lean();
    expect(initialDocs.length).toBe(2);

    // Rotate device A's token. Device B's token should still be usable.
    await authService.refreshToken(sessionA.tokens.refreshToken);
    const refreshedB = await authService.refreshToken(sessionB.tokens.refreshToken);
    expect(refreshedB.refreshToken).toMatch(REFRESH_TOKEN_RE);

    // Logout device A using its (post-rotation) raw token. Device B's latest token
    // should still work.
    // After the rotation above, sessionA's original token has replacedBy set.
    // The "current" device-A token is what refreshToken returned — but we don't
    // have it here, so revoke via the userAgent path (rawToken path). Use the
    // helper: revoke by the original raw token. updateOne with the original
    // token's hash will revoke the now-replaced doc (the original) — which is
    // already replacedBy-marked but not revokedAt. That's fine for this test;
    // device B's session must still mint new tokens.
    await authService.logout(u._id.toString(), { rawToken: sessionA.tokens.refreshToken });

    const refreshedB2 = await authService.refreshToken(refreshedB.refreshToken);
    expect(refreshedB2.refreshToken).toMatch(REFRESH_TOKEN_RE);
  });
});

describe('authService.logout', () => {
  it('revokes the supplied refresh token (per-device logout)', async () => {
    const frank = FIXTURES.user('frank');
    const session = await authService.login({ email: frank.email, password: frank.password });
    await authService.logout(frank._id.toString(), { rawToken: session.tokens.refreshToken });

    const doc = await RefreshToken.findOne({
      tokenHash: hashToken(session.tokens.refreshToken),
    }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.revokedAt).not.toBeNull();
    expect(doc!.revokedAt).toBeTruthy();

    // The revoked token must not be acceptable for refresh anymore.
    await expect(
      authService.refreshToken(session.tokens.refreshToken),
    ).rejects.toSatisfy(expectAppError(401));
  });

  it('without rawToken, revokes all active sessions for the user', async () => {
    const u = await User.create({
      email: 'logout-all@example.com',
      password: 'Password123!',
      firstName: 'Logout',
      lastName: 'All',
    });
    await authService.login(
      { email: 'logout-all@example.com', password: 'Password123!' },
      { userAgent: 'A' },
    );
    await authService.login(
      { email: 'logout-all@example.com', password: 'Password123!' },
      { userAgent: 'B' },
    );

    const beforeActive = await RefreshToken.countDocuments({
      userId: u._id,
      revokedAt: null,
    });
    expect(beforeActive).toBe(2);

    await authService.logout(u._id.toString());

    const afterActive = await RefreshToken.countDocuments({
      userId: u._id,
      revokedAt: null,
    });
    expect(afterActive).toBe(0);
  });
});

describe('authService.verifyEmail', () => {
  it('marks isEmailVerified=true and clears the token fields', async () => {
    // Dave is the unverified seeded user. Set a known token to test the flow.
    const dave = FIXTURES.user('dave');
    const rawToken = 'a'.repeat(64);
    await User.updateOne(
      { _id: dave._id },
      {
        emailVerificationToken: hashToken(rawToken),
        emailVerificationExpires: new Date(Date.now() + 60_000),
      },
    );

    await authService.verifyEmail(rawToken);
    const stored = await User.findById(dave._id)
      .select('+emailVerificationToken +emailVerificationExpires')
      .lean();
    expect(stored?.isEmailVerified).toBe(true);
    expect(stored?.emailVerificationToken).toBeFalsy();
    expect(stored?.emailVerificationExpires).toBeFalsy();
  });

  it('throws BadRequestError (400) on invalid token', async () => {
    await expect(authService.verifyEmail('totally-invalid-token')).rejects.toSatisfy(
      expectAppError(400),
    );
  });

  it('throws BadRequestError (400) on expired token', async () => {
    // Use a fresh user to avoid colliding with dave (now verified above).
    const expiredUser = await User.create({
      email: 'expired-verify@example.com',
      password: 'Password123!',
      firstName: 'Exp',
      lastName: 'Ired',
    });
    const rawToken = 'b'.repeat(64);
    await User.updateOne(
      { _id: expiredUser._id },
      {
        isEmailVerified: false,
        emailVerificationToken: hashToken(rawToken),
        emailVerificationExpires: new Date(Date.now() - 60_000), // already expired
      },
    );
    await expect(authService.verifyEmail(rawToken)).rejects.toSatisfy(expectAppError(400));
  });
});

describe('authService.forgotPassword', () => {
  beforeEach(() => {
    vi.mocked(emailMod.sendPasswordResetEmail).mockClear();
  });

  it('sends a reset email and stores a hashed token for known users', async () => {
    const bob = FIXTURES.user('bob');
    await authService.forgotPassword(bob.email);

    const stored = await User.findById(bob._id)
      .select('+passwordResetToken +passwordResetExpires')
      .lean();
    expect(stored?.passwordResetToken).toBeTruthy();
    expect(stored?.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
    expect(emailMod.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('silently returns for unknown emails (anti-enumeration)', async () => {
    await expect(
      authService.forgotPassword('nobody-forgot@nowhere.com'),
    ).resolves.toBeUndefined();
    expect(emailMod.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('authService.resetPassword', () => {
  it('updates the password and clears the reset token; new password works', async () => {
    // Create a one-off user so we don't disturb seeded fixtures used by other tests.
    const target = await User.create({
      email: 'reset-target@example.com',
      password: 'Password123!',
      firstName: 'Reset',
      lastName: 'Target',
    });
    const rawToken = 'c'.repeat(64);
    await User.updateOne(
      { _id: target._id },
      {
        passwordResetToken: hashToken(rawToken),
        passwordResetExpires: new Date(Date.now() + 60_000),
      },
    );

    await authService.resetPassword(rawToken, 'BrandNewPass1!');

    // Login with new password should succeed.
    const result = await authService.login({
      email: 'reset-target@example.com',
      password: 'BrandNewPass1!',
    });
    expect(result.user._id).toBe(target._id.toString());

    // Old reset token + expiry should be cleared.
    const stored = await User.findById(target._id)
      .select('+passwordResetToken +passwordResetExpires')
      .lean();
    expect(stored?.passwordResetToken).toBeFalsy();
    expect(stored?.passwordResetExpires).toBeFalsy();
  });

  it('throws BadRequestError (400) on invalid token', async () => {
    await expect(
      authService.resetPassword('garbage-token', 'Whatever1!'),
    ).rejects.toSatisfy(expectAppError(400));
  });

  // F1.4 — production filters by passwordResetExpires: { $gt: new Date() }, so
  // an expired token must be rejected exactly like an invalid one.
  // See BackEnd/src/services/auth.service.ts:216-222.
  it('throws BadRequestError (400) on expired reset token', async () => {
    const expiredUser = await User.create({
      email: 'expired-reset@example.com',
      password: 'Password123!',
      firstName: 'Exp',
      lastName: 'Reset',
    });
    const rawToken = 'd'.repeat(64);
    await User.updateOne(
      { _id: expiredUser._id },
      {
        passwordResetToken: hashToken(rawToken),
        passwordResetExpires: new Date(Date.now() - 60_000), // already expired
      },
    );

    await expect(
      authService.resetPassword(rawToken, 'New_Password_123!'),
    ).rejects.toSatisfy(expectAppError(400));
  });
});

describe('authService.getMe', () => {
  it('returns the current user (households is an array of household ids)', async () => {
    const alice = FIXTURES.user('alice');
    const me = await authService.getMe(alice._id.toString());
    expect(me.email).toBe(alice.email);
    expect(me._id).toBe(alice._id.toString());
    expect(Array.isArray(me.households)).toBe(true);
    // Alice belongs to the seeded couple household, so households should have at least 1 entry.
    expect(me.households.length).toBeGreaterThan(0);
  });

  it('throws NotFoundError (404) when user does not exist', async () => {
    await expect(
      authService.getMe(new Types.ObjectId().toString()),
    ).rejects.toSatisfy(expectAppError(404));
  });
});
