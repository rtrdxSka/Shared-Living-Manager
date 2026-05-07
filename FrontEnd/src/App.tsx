import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import { QueryClientProvider } from '@tanstack/react-query';
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
const ShoppingListPage = lazy(() => import('@/pages/dashboard/ShoppingListPage'));
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
    <div className="flex h-screen w-full items-center justify-center bg-bg">
      <p className="text-sm font-mono uppercase tracking-[0.14em] text-accent animate-pulse">
        ▸ HouseMate · loading direction
      </p>
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

// Module-scope router — must NOT be re-created per render, or blocker/history state resets.
const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },

      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/get-started', element: <GetStartedPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview',      element: <OverviewPage /> },
          { path: 'expenses',      element: <ExpensesPage /> },
          { path: 'tasks',         element: <TasksPage /> },
          { path: 'shopping-list', element: <ShoppingListPage /> },
          { path: 'goals',         element: <GoalsPage /> },
          { path: 'account',       element: <AccountPage /> },
          { path: 'invite',        element: <InvitePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="system">
          <PWAUpdatePrompt />
          <Suspense fallback={<PageFallback />}>
            <RouterProvider router={router} />
          </Suspense>
        </ThemeProvider>
      </AuthProvider>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
