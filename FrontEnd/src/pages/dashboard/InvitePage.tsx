import { useState } from 'react';
import { Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useRegenerateInviteCode } from '@/hooks/queries';

export default function InvitePage() {
  const { household, isAdmin } = useDashboard();
  const [copied, setCopied] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const regenerateMutation = useRegenerateInviteCode(household._id);

  function handleCopy() {
    void navigator.clipboard.writeText(household.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRegenerate() {
    await regenerateMutation.mutateAsync();
    setConfirmingRegenerate(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Invite</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Share your invite code so others can join {household.name}
        </p>
      </div>

      {/* Invite code card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invite Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Share this code with your household members. They can enter it on the Get Started page to join.
          </p>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <code className="flex-1 font-mono text-sm tracking-wider break-all select-all">
              {household.inviteCode}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Regenerate — admin only */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!confirmingRegenerate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setConfirmingRegenerate(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </Button>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    This will invalidate the current code. Continue?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => void handleRegenerate()}
                    disabled={regenerateMutation.isPending}
                  >
                    {regenerateMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Yes, regenerate'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setConfirmingRegenerate(false)}
                    disabled={regenerateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Household members card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Household Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {household.members.map((member) => {
            const hasJoined = !!member.userId;
            return (
              <div
                key={member._id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{member.nickname}</p>
                  {member.email && (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                <span
                  className={
                    hasJoined
                      ? 'rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300'
                      : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                  }
                >
                  {hasJoined ? 'Joined' : 'Pending'}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
