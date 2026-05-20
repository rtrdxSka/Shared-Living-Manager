import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import { mockUser } from '@/test/mocks/data/user';
import LoginPage from '@/pages/LoginPage';

describe('LoginPage (smoke)', () => {
  it('renders the login form', async () => {
    renderWithProviders(<LoginPage />);

    expect(
      await screen.findByPlaceholderText('ivan@example.com'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('submits the form with the entered credentials', async () => {
    let receivedBody: { email: string; password: string } | null = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        receivedBody = (await request.json()) as {
          email: string;
          password: string;
        };
        return HttpResponse.json({
          status: 'success',
          data: {
            user: mockUser,
            tokens: { accessToken: 'test-access-token' },
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = await screen.findByPlaceholderText('ivan@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    await user.type(emailInput, 'alice@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(receivedBody).toEqual({
        email: 'alice@example.com',
        password: 'password123',
      });
    });
  });
});
