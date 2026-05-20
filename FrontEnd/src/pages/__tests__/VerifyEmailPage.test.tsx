import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

describe('<VerifyEmailPage />', () => {
  it('shows success state when token is valid', async () => {
    server.use(
      http.post('/api/auth/verify-email', () =>
        HttpResponse.json({ status: 'success', message: 'Email verified' }),
      ),
    );
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=valid' });
    expect(await screen.findByRole('heading', { name: /verified/ })).toBeInTheDocument();
  });

  it('shows error state when token is missing', () => {
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email' });
    expect(screen.getByText('No verification token provided')).toBeInTheDocument();
  });

  it('shows error state when verification fails server-side', async () => {
    server.use(
      http.post('/api/auth/verify-email', () =>
        HttpResponse.json({ status: 'error', message: 'Token expired' }, { status: 400 }),
      ),
    );
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=expired' });
    expect(await screen.findByText(/Token expired/)).toBeInTheDocument();
  });
});
