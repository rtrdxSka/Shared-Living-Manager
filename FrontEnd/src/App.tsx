import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ProtectedRoute, GuestRoute } from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';

import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import GetStartedPage from '@/pages/GetStartedPage';
import DashboardPage from '@/pages/DashboardPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ProfilePage from '@/pages/ProfilePage';

import OverviewPage from '@/pages/dashboard/OverviewPage';
import ExpensesPage from '@/pages/dashboard/ExpensesPage';
import TasksPage from '@/pages/dashboard/TasksPage';
import GoalsPage from '@/pages/dashboard/GoalsPage';
import AccountPage from '@/pages/dashboard/AccountPage';

// Layout for all public/non-dashboard pages (keeps the top navbar)
function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider defaultTheme="system">
            <Routes>
              {/* ── Public pages (with Navbar) ── */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* Guest only */}
                <Route element={<GuestRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                {/* Protected pages that still use the Navbar */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/get-started" element={<GetStartedPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
              </Route>

              {/* ── Dashboard (sidebar layout, no Navbar) ── */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="account" element={<AccountPage />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ThemeProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
