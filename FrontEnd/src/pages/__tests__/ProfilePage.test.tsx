import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ProfilePage from '@/pages/ProfilePage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '@/test/mocks/data/users';

const renderAuthenticated = () => {
  server.use(
    http.post('/api/auth/refresh', () =>
      HttpResponse.json({ status: 'success', data: { tokens: mockTokens } }),
    ),
    http.get('/api/auth/me', () =>
      HttpResponse.json({ status: 'success', data: { user: mockUsers.alice } }),
    ),
  );
  return renderWithProviders(<ProfilePage />);
};

describe('<ProfilePage />', () => {
  it('renders profile fields pre-populated with user data', async () => {
    renderAuthenticated();
    // Wait for AuthProvider to finish loading and render profile form
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Anderson')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('shows password change fields and submit button', async () => {
    renderAuthenticated();
    await waitFor(() => {
      // Three password inputs with placeholder "••••••••"
      const passwordInputs = screen.queryAllByPlaceholderText('••••••••');
      expect(passwordInputs.length).toBeGreaterThanOrEqual(3);
    });
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('updates first name and shows success message', async () => {
    server.use(
      http.patch('/api/users/profile', async ({ request }) => {
        const body = (await request.json()) as Partial<typeof mockUsers.alice>;
        return HttpResponse.json({
          status: 'success',
          data: { user: { ...mockUsers.alice, ...body } },
        });
      }),
    );
    renderAuthenticated();
    const user = userEvent.setup();

    const firstName = await screen.findByDisplayValue('Alice');
    await user.clear(firstName);
    await user.type(firstName, 'Alicia');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
  });
});
