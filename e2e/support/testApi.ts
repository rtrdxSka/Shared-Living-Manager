import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';

/**
 * Direct (un-versioned) base for the backend. Tests target the absolute URL
 * so this helper does not rely on Playwright's project-level baseURL (which is
 * set to the frontend at :4173).
 */
const API_BASE = 'http://localhost:5001';

/**
 * Wrapper around the test-only endpoints mounted under `/api/__test__/*` when
 * the backend is started with NODE_ENV=test. The routes are physically absent
 * in any other environment (see BackEnd/src/index.ts conditional mount), so
 * this helper is safe to use anywhere the e2e backend is running.
 */
export class TestApi {
  private readonly api: APIRequestContext;

  private constructor(api: APIRequestContext) {
    this.api = api;
  }

  static async create(): Promise<TestApi> {
    const api = await playwrightRequest.newContext({ baseURL: API_BASE });
    return new TestApi(api);
  }

  /** Drops every collection in the e2e database. Called from each test's `beforeEach`. */
  async resetDatabase(): Promise<void> {
    const res = await this.api.post('/api/__test__/reset');
    if (!res.ok()) {
      throw new Error(`reset failed: ${res.status()} ${await res.text()}`);
    }
  }

  /**
   * Fetches the latest verify- or password-reset token for a user. The backend
   * reads the raw token off the user document (set by `authService.register` /
   * `requestPasswordReset`). Returns the 64-char hex string we then POST back
   * to `/auth/verify-email` or `/auth/reset-password`.
   */
  async getLastToken(email: string, type: 'verify' | 'reset' = 'verify'): Promise<string> {
    const res = await this.api.get('/api/__test__/last-token', {
      params: { email, type },
    });
    if (!res.ok()) {
      throw new Error(`last-token failed for ${email}/${type}: ${res.status()} ${await res.text()}`);
    }
    const json = (await res.json()) as { token: string };
    return json.token;
  }

  /**
   * Returns whether the in-memory mock email service queued a verify/reset
   * email for the given address. Used to assert side-effects without a real
   * SMTP round-trip.
   */
  async getEmailStatus(email: string): Promise<{ verifyEmailSent: boolean; resetEmailSent: boolean }> {
    const res = await this.api.get('/api/__test__/email-status', {
      params: { email },
    });
    if (!res.ok()) {
      throw new Error(`email-status failed for ${email}: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { verifyEmailSent: boolean; resetEmailSent: boolean };
  }

  /**
   * Backdates a household's `taskRotationConfig.startedAt` so that the next
   * period boundary has effectively been crossed. Lets us exercise rotation
   * progression without sleeping in tests.
   */
  async fastForwardRotation(householdId: string, daysBack: number): Promise<void> {
    const res = await this.api.post('/api/__test__/fast-forward-rotation', {
      data: { householdId, daysBack },
    });
    if (!res.ok()) {
      throw new Error(`fast-forward failed: ${res.status()} ${await res.text()}`);
    }
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }
}
