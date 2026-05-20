import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { userService } from '../../../src/services/user.service';
import { authService } from '../../../src/services/auth.service';
import { User } from '../../../src/models/user.model';
import { AppError } from '../../../src/utils/error';
import * as emailMod from '../../../src/utils/email';
import { FIXTURES } from '../../seed/fixtures';

// Same AppError + statusCode pattern as the auth.service tests — error helpers are
// arrow-function factories, not classes, so we can't use `instanceof` against them.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

describe('userService.updateProfile', () => {
  beforeEach(() => {
    vi.mocked(emailMod.sendVerificationEmail).mockClear();
  });

  it('updates first/last name without password verification (emailChanged: false)', async () => {
    // Use carol so we don't disturb alice/bob, who are referenced by other tests.
    const carol = FIXTURES.user('carol');
    const { user, emailChanged } = await userService.updateProfile(carol._id.toString(), {
      firstName: 'Caroline',
      lastName: 'Carter-New',
    });
    expect(user.firstName).toBe('Caroline');
    expect(user.lastName).toBe('Carter-New');
    expect(emailChanged).toBe(false);
    expect(emailMod.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('changing email requires currentPassword and re-verifies', async () => {
    // Frank is referenced only by the flatshare household; safe to mutate his email.
    const frank = FIXTURES.user('frank');
    const newEmail = 'frank-renamed@example.com';
    const { user, emailChanged } = await userService.updateProfile(frank._id.toString(), {
      email: newEmail,
      currentPassword: frank.password,
    });
    expect(user.email).toBe(newEmail);
    expect(emailChanged).toBe(true);

    const stored = await User.findById(frank._id).lean();
    expect(stored?.isEmailVerified).toBe(false);
    expect(emailMod.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('rejects email change without currentPassword (BadRequest 400)', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      userService.updateProfile(alice._id.toString(), {
        email: 'alice-no-pwd@example.com',
      }),
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('rejects email change with wrong currentPassword (Unauthorized 401)', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      userService.updateProfile(alice._id.toString(), {
        email: 'alice-wrong-pwd@example.com',
        currentPassword: 'WrongPassword!',
      }),
    ).rejects.toSatisfy(expectAppError(401));
  });

  it('rejects email change to one already in use (Conflict 409)', async () => {
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    await expect(
      userService.updateProfile(alice._id.toString(), {
        email: bob.email,
        currentPassword: alice.password,
      }),
    ).rejects.toSatisfy(expectAppError(409));
  });

  it('throws NotFoundError (404) when user does not exist', async () => {
    await expect(
      userService.updateProfile(new Types.ObjectId().toString(), {
        firstName: 'X',
      }),
    ).rejects.toSatisfy(expectAppError(404));
  });
});

describe('userService.changePassword', () => {
  it('updates password and invalidates existing refresh tokens', async () => {
    // Eve is in the flatshare household but not referenced by other tests in this file
    // (alice/bob/carol/frank all are). Safer to mutate her credentials here.
    const eve = FIXTURES.user('eve');

    // Establish an active session.
    const session = await authService.login({ email: eve.email, password: eve.password });

    await userService.changePassword(eve._id.toString(), {
      currentPassword: eve.password,
      newPassword: 'BrandNewPass1!',
    });

    // Old session's refresh token should now be invalid (refreshToken cleared).
    await expect(
      authService.refreshToken(session.tokens.refreshToken),
    ).rejects.toSatisfy(expectAppError(401));

    // Login with new password should work.
    const newSession = await authService.login({
      email: eve.email,
      password: 'BrandNewPass1!',
    });
    expect(newSession.user._id).toBe(eve._id.toString());
  });

  it('rejects with UnauthorizedError (401) on wrong current password', async () => {
    const alice = FIXTURES.user('alice');
    await expect(
      userService.changePassword(alice._id.toString(), {
        currentPassword: 'WrongPassword!',
        newPassword: 'BrandNewPass1!',
      }),
    ).rejects.toSatisfy(expectAppError(401));
  });

  it('throws NotFoundError (404) when user does not exist', async () => {
    await expect(
      userService.changePassword(new Types.ObjectId().toString(), {
        currentPassword: 'X',
        newPassword: 'Y1!',
      }),
    ).rejects.toSatisfy(expectAppError(404));
  });

  // F1.7 — Documented trade-off: changePassword revokes refresh tokens but does
  // NOT invalidate already-issued access tokens (they remain valid until their
  // 15-min TTL). See BackEnd/src/services/auth.service.ts:234-235.
  // This test fences the trade-off so an accidental future change (e.g. adding
  // a JWT blacklist) is caught.
  it('does not invalidate existing access tokens (documented trade-off)', async () => {
    // Use a one-off user so we don't disturb seeded fixtures.
    const target = await User.create({
      email: 'access-token-survives@example.com',
      password: 'Password123!',
      firstName: 'Access',
      lastName: 'Survive',
    });

    // Acquire a real access token via the production login flow.
    const session = await authService.login({
      email: 'access-token-survives@example.com',
      password: 'Password123!',
    });
    const accessToken = session.tokens.accessToken;

    // Change the password.
    await userService.changePassword(target._id.toString(), {
      currentPassword: 'Password123!',
      newPassword: 'BrandNewPass1!',
    });

    // The original access token must still verify — accepted trade-off.
    const secret = process.env.JWT_ACCESS_SECRET!;
    const decoded = jwt.verify(accessToken, secret, { algorithms: ['HS256'] }) as {
      userId: string;
      email: string;
    };
    expect(decoded.userId).toBe(target._id.toString());
    expect(decoded.email).toBe('access-token-survives@example.com');
  });
});
