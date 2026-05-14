import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '@/test/mocks/data/users';

const Dashboard = () => <div>Dashboard content</div>;
const Login = () => <div>Login page</div>;
const Profile = () => <div>Profile page</div>;

const TestRoutes = () => (
  <Routes>
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
    </Route>
    <Route path="/login" element={<Login />} />
  </Routes>
);

describe('<ProtectedRoute />', () => {
  it('redirects to /login when not authenticated', async () => {
    renderWithProviders(<TestRoutes />, { route: '/dashboard' });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('renders the child route when authenticated and verified', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ status: 'success', data: { tokens: mockTokens } }),
      ),
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 'success', data: { user: mockUsers.alice } }),
      ),
    );
    renderWithProviders(<TestRoutes />, { route: '/dashboard' });
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  });

  it('redirects to /profile when authenticated but unverified', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ status: 'success', data: { tokens: mockTokens } }),
      ),
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 'success', data: { user: mockUsers.daveUnverified } }),
      ),
    );
    renderWithProviders(<TestRoutes />, { route: '/dashboard' });
    expect(await screen.findByText('Profile page')).toBeInTheDocument();
  });
});
