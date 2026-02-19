import { Navigate, Outlet } from 'react-router-dom';

import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ── Loading spinner shown during initial auth check ───────────────────

function AuthLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// ── Requires authentication ───────────────────────────────────────────

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

// ── Requires guest (not authenticated) ────────────────────────────────

export function GuestRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <AuthLoading />;

  if (isAuthenticated) {
    // Post-auth routing decision from the plan
    const hasHouseholds = user && user.households.length > 0;
    return <Navigate to={hasHouseholds ? '/dashboard' : '/get-started'} replace />;
  }

  return <Outlet />;
}