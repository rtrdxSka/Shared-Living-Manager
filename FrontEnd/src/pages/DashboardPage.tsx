import { useLocation } from 'react-router-dom';
import { Loader2, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/queries';
import type { HouseholdResponse } from '@/types/household.types';
import CoupleDashboardShell from '@/components/dashboard/couple/CoupleDashboardShell';
import RoommatesDashboardShell from '@/components/dashboard/roommates/RoommatesDashboardShell';

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();

  const initialHousehold =
    (location.state as { createdHousehold?: HouseholdResponse } | null)
      ?.createdHousehold ?? undefined;

  const { data: household, isLoading, error } = useHousehold(user?.activeHousehold);

  // Use route-state household for instant render while query loads
  const resolved = household ?? initialHousehold ?? null;

  if (isLoading && !resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-destructive">Failed to load household information.</p>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <Card className="relative w-full max-w-lg rounded-2xl border-border/60 shadow-xl">
          <CardHeader className="space-y-4 pb-2 pt-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
              <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">Dashboard</CardTitle>
              <CardDescription className="text-base">
                Hello, {user?.firstName} {user?.lastName}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 px-6 pb-8 pt-4 sm:px-8">
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                You&apos;re not part of a household yet.
              </p>
              <Button asChild className="h-11 rounded-xl px-6 shadow-sm">
                <Link to="/get-started">Get Started</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolved.uiMode === 'roommates' && user) {
    return <RoommatesDashboardShell household={resolved} currentUserId={user._id} />;
  }

  // For non-couple/solo/roommates modes (future expansion), show a minimal placeholder
  if ((resolved.uiMode !== 'couple' && resolved.uiMode !== 'solo') || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Dashboard for this household type is coming soon.
        </p>
      </div>
    );
  }

  return <CoupleDashboardShell household={resolved} currentUserId={user._id} />;
}
