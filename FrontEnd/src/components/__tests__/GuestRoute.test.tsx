import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { GuestRoute } from '@/components/ProtectedRoute';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockUsers, mockTokens } from '@/test/mocks/data/users';

const Login = () => <div>Login form</div>;
const Dashboard = () => <div>Dashboard</div>;
const GetStarted = () => <div>Get Started</div>;

const TestRoutes = () => (
  <Routes>
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<Login />} />
    </Route>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/get-started" element={<GetStarted />} />
  </Routes>
);

describe('<GuestRoute />', () => {
  it('renders the child route when not authenticated', async () => {
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Login form')).toBeInTheDocument();
  });

  it('redirects authenticated users with a household to /dashboard', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ status: 'success', data: { tokens: mockTokens } }),
      ),
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 'success', data: { user: mockUsers.alice } }),
      ),
    );
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('redirects authenticated users with no household to /get-started', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ status: 'success', data: { tokens: mockTokens } }),
      ),
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 'success', data: { user: mockUsers.evaNoHousehold } }),
      ),
    );
    renderWithProviders(<TestRoutes />, { route: '/login' });
    expect(await screen.findByText('Get Started')).toBeInTheDocument();
  });
});
