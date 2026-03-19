import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Check, Loader2, LayoutDashboard } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/queries';
import type { HouseholdResponse } from '@/types/household.types';
import CoupleDashboard from '@/components/dashboard/couple/CoupleDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();

  const initialHousehold =
    (location.state as { createdHousehold?: HouseholdResponse } | null)
      ?.createdHousehold ?? undefined;

  const {
    data: household,
    isLoading,
    error,
  } = useHousehold(user?.activeHousehold);

  const [copied, setCopied] = useState(false);

  // Use route-state household while query is still loading for instant render
  const resolved = household ?? initialHousehold ?? null;

  const handleCopy = async () => {
    if (!resolved?.inviteCode) return;

    await navigator.clipboard.writeText(resolved.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (resolved?.uiMode === 'couple' && user) {
    return (
      <CoupleDashboard
        household={resolved}
        currentUserId={user._id}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <Card className="relative w-full max-w-lg rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Dashboard
            </CardTitle>
            <CardDescription className="text-base">
              Hello, {user?.firstName} {user?.lastName}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 px-6 pb-8 pt-4 sm:px-8">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-destructive">Failed to load household information.</p>
          )}

          {resolved && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Household</p>
                <p className="text-lg font-semibold">{resolved.name}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Invite Code
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                    <span className="font-mono text-sm tracking-wide">
                      {resolved.inviteCode}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this code with household members so they can join
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
