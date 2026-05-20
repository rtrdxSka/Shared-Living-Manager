import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import RegisterPage from '@/pages/RegisterPage';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

describe('<RegisterPage />', () => {
  it('renders all required fields', () => {
    renderWithProviders(<RegisterPage />);
    // Get inputs using exact placeholder matching since Label doesn't have "for"
    expect(screen.getByPlaceholderText('Ivan')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Smith')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ivan@example.com')).toBeInTheDocument();
    const passwordInputs = screen.getAllByPlaceholderText(/•••/);
    expect(passwordInputs.length).toBe(2);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('rejects mismatched passwords (client-side validation)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByPlaceholderText('Ivan'), 'Alice');
    await user.type(screen.getByPlaceholderText('Smith'), 'Anderson');
    await user.type(screen.getByPlaceholderText('ivan@example.com'), 'a@b.co');
    const passwordInputs = screen.getAllByPlaceholderText(/•••/);
    await user.type(passwordInputs[0], 'Password123!');
    await user.type(passwordInputs[1], 'Different1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/match|mismatch|same/i)).toBeInTheDocument();
  });

  it('shows server error on duplicate email', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { status: 'error', message: 'Email already in use' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByPlaceholderText('Ivan'), 'Alice');
    await user.type(screen.getByPlaceholderText('Smith'), 'Anderson');
    await user.type(screen.getByPlaceholderText('ivan@example.com'), 'taken@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/•••/);
    await user.type(passwordInputs[0], 'Password123!');
    await user.type(passwordInputs[1], 'Password123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
  });
});
