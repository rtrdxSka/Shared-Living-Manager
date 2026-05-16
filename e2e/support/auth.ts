import {
  expect,
  request as playwrightRequest,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import { TestApi } from './testApi';

// Backend root (NOT including `/api`). Playwright's `request.newContext`
// treats the request path's leading `/` as absolute, so a baseURL like
// `http://localhost:5001/api` would have its path segment stripped on every
// call. Keep baseURL as origin-only and prefix the API version per request.
const API_BASE = 'http://localhost:5001';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Populated by `registerAndVerify` once the backend hands us the user document. */
  userId?: string;
}

/**
 * API-driven setup primitive: registers the user, fetches the latest verify
 * token via the test-only endpoint, then POSTs it back to `/auth/verify-email`.
 *
 * Used by every test that needs a verified account but doesn't care about the
 * register-UI experience itself.
 *
 * Response shape (confirmed in `auth.controller.ts`):
 *   { status: 'success', data: { user: { _id, ... }, tokens: { accessToken } } }
 */
export async function registerAndVerify(user: TestUser): Promise<TestUser> {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE });

  try {
    const registerRes = await api.post('/api/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
    if (!registerRes.ok()) {
      throw new Error(`register failed: ${registerRes.status()} ${await registerRes.text()}`);
    }
    const registerBody = (await registerRes.json()) as {
      data?: { user?: { _id?: string } };
      user?: { _id?: string };
      _id?: string;
    };
    user.userId =
      registerBody.data?.user?._id ?? registerBody.user?._id ?? registerBody._id;

    const testApi = await TestApi.create();
    const token = await testApi.getLastToken(user.email, 'verify');
    await testApi.dispose();

    // POST /api/auth/verify-email { token } — confirmed in auth.routes.ts /
    // verifyEmailValidation.
    const verifyRes = await api.post('/api/auth/verify-email', {
      data: { token },
    });
    if (!verifyRes.ok()) {
      throw new Error(`verify failed: ${verifyRes.status()} ${await verifyRes.text()}`);
    }
  } finally {
    await api.dispose();
  }

  return user;
}

/**
 * Drive the /login form through the browser. Asserts that after submit the
 * user lands on /dashboard, /onboarding, or /get-started (any of which is a
 * legitimate post-login destination depending on whether they have a
 * household yet).
 *
 * The login page's <Label> elements are not bound to inputs via `htmlFor`, so
 * we target inputs by their `placeholder` text instead. This matches the
 * actual DOM (`placeholder="ivan@example.com"`, `placeholder="••••••••"`)
 * grepped from LoginPage.tsx.
 */
export async function loginAs(
  context: BrowserContext,
  email: string,
  password: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('ivan@example.com').fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding|get-started)/, { timeout: 10_000 });
  return page;
}

/**
 * Drives the /register form. Used by the auth-flow specs (A01, A02) where
 * the register UI itself is under test.
 *
 * After a successful submit the user is redirected to /verify-email (or
 * shown a "check your email" message — implementer should adjust the
 * assertion if the actual redirect differs). The post-submit assertion
 * is intentionally permissive.
 */
export async function uiRegister(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  // First-name placeholder `Ivan` is a substring of `ivan@example.com`, and
  // Playwright's getByPlaceholder is case-insensitive substring by default.
  // Use exact:true so we don't accidentally also match the email input.
  await page.getByPlaceholder('Ivan', { exact: true }).fill(user.firstName);
  await page.getByPlaceholder('Smith', { exact: true }).fill(user.lastName);
  await page.getByPlaceholder('ivan@example.com').fill(user.email);
  // Password + Confirm password share placeholder="••••••••". `.first()` is
  // password, `.nth(1)` is confirm.
  const passwordFields = page.getByPlaceholder('••••••••');
  await passwordFields.nth(0).fill(user.password);
  await passwordFields.nth(1).fill(user.password);
  await page.getByRole('button', { name: /create account/i }).click();

  // The register flow either redirects to /verify-email or shows a "check
  // your email" message. Accept either by waiting for a URL change away
  // from /register.
  await page.waitForURL((url) => !url.pathname.endsWith('/register'), {
    timeout: 10_000,
  });
}

/**
 * Drive the verify-email page in the browser. The frontend reads the token
 * from `?token=...` (see VerifyEmailPage.tsx), then POSTs to
 * `/auth/verify-email`. On success the page shows "You're verified".
 */
export async function uiVerifyEmail(page: Page, email: string): Promise<void> {
  const testApi = await TestApi.create();
  const token = await testApi.getLastToken(email, 'verify');
  await testApi.dispose();
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10_000 });
}
