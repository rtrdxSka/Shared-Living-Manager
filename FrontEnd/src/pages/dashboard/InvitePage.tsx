import { useState } from 'react';
import { Mail, Send, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { BlobBack } from '@/components/ui/blob-back';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useDashboard } from '@/contexts/DashboardContext';
import { useRegenerateInviteCode } from '@/hooks/queries';

export default function InvitePage() {
  const { household, isAdmin, myNickname } = useDashboard();
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
    <>
      <DashboardHeader title="Invite" subtitle="Add your partner to the household" />

      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 overflow-hidden">
        <BlobBack className="absolute -top-10 -left-10" color="accent" size={300} />
        <BlobBack className="absolute -bottom-10 -right-10" color="cat-rent" size={260} />

        <div className="relative w-full max-w-[480px] rounded-2xl border border-line bg-surface text-ink shadow-hero p-8 space-y-6">
          {/* overlapping avatars */}
          <div className="flex items-center justify-center -space-x-4">
            <Avatar
              name={myNickname}
              size={64}
              variant="filled"
              style={{ boxShadow: '0 0 0 4px hsl(var(--surface))' }}
            />
            <Avatar
              size={64}
              variant="ghost"
              style={{ boxShadow: '0 0 0 4px hsl(var(--surface))' }}
            />
          </div>

          {/* heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-ink">
              Bring your{' '}
              <span className="font-serif italic text-accent">person</span>{' '}
              in
            </h1>
            <p className="text-sm text-ink-3">
              Share the code below — they'll be set up in seconds.
            </p>
          </div>

          {/* invite code row */}
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
            <code className="flex-1 truncate font-mono text-xs text-ink-2 px-2 tracking-wider">
              {household.inviteCode}
            </code>
            <Button size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {/* 2-col ghost buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={(e) => e.preventDefault()}
              disabled
            >
              <Mail className="h-4 w-4 mr-2" />
              Email invite
            </Button>
            <Button
              variant="outline"
              onClick={(e) => e.preventDefault()}
              disabled
            >
              <Send className="h-4 w-4 mr-2" />
              Text invite
            </Button>
          </div>

          {/* admin: regenerate */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              {!confirmingRegenerate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-ink-3"
                  onClick={() => setConfirmingRegenerate(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate code
                </Button>
              ) : (
                <>
                  <span className="text-xs text-ink-3">
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

          {/* footnote */}
          <p className="text-center text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
            Only one person can join · code never expires
          </p>
        </div>
      </div>
    </>
  );
}
