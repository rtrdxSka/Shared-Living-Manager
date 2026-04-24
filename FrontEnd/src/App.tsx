import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import { QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ProtectedRoute, GuestRoute } from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';

// Eager — lightweight public entry points
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

// Lazy — post-auth and auth-flow pages get their own chunks
const GetStartedPage     = lazy(() => import('@/pages/GetStartedPage'));
const DashboardPage      = lazy(() => import('@/pages/DashboardPage'));
const VerifyEmailPage    = lazy(() => import('@/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('@/pages/ResetPasswordPage'));
const ProfilePage        = lazy(() => import('@/pages/ProfilePage'));

const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage'));
const ExpensesPage = lazy(() => import('@/pages/dashboard/ExpensesPage'));
const TasksPage    = lazy(() => import('@/pages/dashboard/TasksPage'));
const GoalsPage    = lazy(() => import('@/pages/dashboard/GoalsPage'));
const AccountPage  = lazy(() => import('@/pages/dashboard/AccountPage'));
const InvitePage   = lazy(() => import('@/pages/dashboard/InvitePage'));

// Dev-only devtools — tree-shaken out of the production bundle
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))
    )
  : () => null;

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

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
            <PWAUpdatePrompt />
            <Suspense fallback={<PageFallback />}>
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
                    <Route path="invite" element={<InvitePage />} />
                  </Route>
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ThemeProvider>
        </AuthProvider>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </BrowserRouter>
  );
}
