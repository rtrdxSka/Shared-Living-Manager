import { useEffect, useState } from 'react';
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
import { householdApi } from '@/api/household.api';
import type { HouseholdResponse } from '@/types/household.types';

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();

  const [household, setHousehold] = useState<HouseholdResponse | null>(
    (location.state as { createdHousehold?: HouseholdResponse } | null)
      ?.createdHousehold ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If we already have household data from route state, skip fetching
    if (household) return;

    if (!user?.activeHousehold) return;

    setIsLoading(true);
    householdApi
      .getById(user.activeHousehold)
      .then((data) => setHousehold(data))
      .catch(() => setError('Failed to load household information.'))
      .finally(() => setIsLoading(false));
  }, [user?.activeHousehold, household]);

  const handleCopy = async () => {
    if (!household?.inviteCode) return;

    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          {household && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Household</p>
                <p className="text-lg font-semibold">{household.name}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Invite Code
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                    <span className="font-mono text-sm tracking-wide">
                      {household.inviteCode}
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
