import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import * as authApi from '@/api/auth.api';

vi.mock('@/api/auth.api');

describe('<ForgotPasswordPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email field and submit button', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByPlaceholderText('ivan@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows success state after successful submit', async () => {
    vi.mocked(authApi.authApi.forgotPassword).mockResolvedValueOnce(
      'If an account exists with that email, we have sent a reset link.',
    );

    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByPlaceholderText('ivan@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/if an account exists with that email/i)).toBeInTheDocument();
  });

  it('rejects invalid email format on client side', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByPlaceholderText('ivan@example.com'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    // Client-side validation should prevent API call
    expect(authApi.authApi.forgotPassword).not.toHaveBeenCalled();
  });
});
