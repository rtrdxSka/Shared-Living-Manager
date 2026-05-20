import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

describe('<ResetPasswordPage />', () => {
  it('shows invalid-token state when no token in query string', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password' });
    expect(screen.getByRole('heading', { name: /invalid/i })).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });

  it('renders the form when token is present', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });
    // Both password inputs have the same placeholder
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    expect(passwordInputs.length).toBe(2);
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows success state after a valid reset', async () => {
    server.use(
      http.post('/api/auth/reset-password', () =>
        HttpResponse.json({ status: 'success', message: 'Password reset successfully' }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordInputs[0], 'BrandNewPass1!');
    await user.type(passwordInputs[1], 'BrandNewPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/password.*reset/i)).toBeInTheDocument();
    expect(await screen.findByText(/reset successfully/i)).toBeInTheDocument();
  });

  it('shows error from server on bad token', async () => {
    server.use(
      http.post('/api/auth/reset-password', () =>
        HttpResponse.json(
          { status: 'error', message: 'Token expired or invalid' },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=expired123' });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordInputs[0], 'BrandNewPass1!');
    await user.type(passwordInputs[1], 'BrandNewPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/expired or invalid/i)).toBeInTheDocument();
  });

  it('rejects mismatched passwords (client-side validation)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordInputs[0], 'BrandNewPass1!');
    await user.type(passwordInputs[1], 'Different1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/match|mismatch|same/i)).toBeInTheDocument();
  });
});
