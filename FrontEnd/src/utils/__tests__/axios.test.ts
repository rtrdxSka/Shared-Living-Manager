import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import api, { tokenStorage } from '../axios';

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { href: 'http://localhost/' },
  });
  tokenStorage.clear();
});

describe('axios refresh-token interceptor', () => {
  it('on 401 → calls /auth/refresh, retries the original request with the new token', async () => {
    const refreshCallSpy = vi.fn();
    let firstCall = true;

    server.use(
      http.get('/api/me-protected', () => {
        if (firstCall) {
          firstCall = false;
          return HttpResponse.json({ status: 'error' }, { status: 401 });
        }
        return HttpResponse.json({ status: 'success', data: { hello: 'world' } });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({
          status: 'success',
          data: { tokens: { accessToken: 'new-access-token' } },
        });
      }),
    );

    const result = await api.get('/me-protected');
    expect(result.data.data.hello).toBe('world');
    expect(refreshCallSpy).toHaveBeenCalledOnce();
    expect(tokenStorage.get()?.accessToken).toBe('new-access-token');
  });

  it('on refresh failure → clears token and redirects to /login', async () => {
    server.use(
      http.get('/api/me-protected', () =>
        HttpResponse.json({ status: 'error' }, { status: 401 }),
      ),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ status: 'error' }, { status: 401 }),
      ),
    );

    await expect(api.get('/me-protected')).rejects.toBeDefined();
    expect(window.location.href).toBe('/login');
    expect(tokenStorage.get()).toBeNull();
  });

  it('parallel 401s → only ONE refresh call, both requests get the new token', async () => {
    const refreshCallSpy = vi.fn();
    let callsToProtected = 0;

    server.use(
      http.get('/api/me-protected', () => {
        callsToProtected += 1;
        if (callsToProtected <= 2) {
          return HttpResponse.json({ status: 'error' }, { status: 401 });
        }
        return HttpResponse.json({ status: 'success', data: { ok: true } });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({
          status: 'success',
          data: { tokens: { accessToken: 'new-token' } },
        });
      }),
    );

    const [a, b] = await Promise.all([
      api.get('/me-protected'),
      api.get('/me-protected'),
    ]);
    expect(a.data.data.ok).toBe(true);
    expect(b.data.data.ok).toBe(true);
    expect(refreshCallSpy).toHaveBeenCalledOnce();
  });

  it('on 403 with "verify your email" message → redirects to /profile', async () => {
    server.use(
      http.get('/api/me-protected', () =>
        HttpResponse.json(
          {
            status: 'error',
            message: 'Please verify your email to access this resource',
          },
          { status: 403 },
        ),
      ),
    );

    await expect(api.get('/me-protected')).rejects.toBeDefined();
    expect(window.location.href).toBe('/profile');
  });

  it('401 on a /login URL → returned to caller unchanged, no refresh, no redirect', async () => {
    const refreshCallSpy = vi.fn();
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { status: 'error', message: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({ status: 'error' }, { status: 401 });
      }),
    );

    await expect(
      api.post('/auth/login', { email: 'a@b.co', password: 'x' }),
    ).rejects.toBeDefined();
    expect(refreshCallSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe('http://localhost/');
    expect(tokenStorage.get()).toBeNull();
  });

  it('_retry flag prevents loop: post-refresh 401 propagates instead of retrying again', async () => {
    const refreshCallSpy = vi.fn();
    server.use(
      http.get('/api/me-protected', () =>
        HttpResponse.json({ status: 'error' }, { status: 401 }),
      ),
      http.post('/api/auth/refresh', () => {
        refreshCallSpy();
        return HttpResponse.json({
          status: 'success',
          data: { tokens: { accessToken: 'new-token' } },
        });
      }),
    );

    await expect(api.get('/me-protected')).rejects.toBeDefined();
    // Refresh succeeded once; the retried protected call also 401'd,
    // but _retry blocks a second refresh attempt.
    expect(refreshCallSpy).toHaveBeenCalledOnce();
  });
});
