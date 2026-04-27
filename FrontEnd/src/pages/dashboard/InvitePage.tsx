import { useState } from 'react';
import { Mail, Send, RefreshCw, Loader2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { BlobBack } from '@/components/ui/blob-back';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useDashboard } from '@/contexts/DashboardContext';
import { useRegenerateInviteCode } from '@/hooks/queries';

export default function InvitePage() {
  const { household, currentUserId, isAdmin, myNickname } = useDashboard();
  const [copied, setCopied] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const regenerateMutation = useRegenerateInviteCode(household._id);

  const isHouseholdFull = household.members.length >= household.totalMembers;

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
      <DashboardHeader
        title={isHouseholdFull ? 'Household' : 'Invite'}
        subtitle={
          isHouseholdFull
            ? "Everyone's in"
            : 'Add your partner to the household'
        }
      />

      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 overflow-hidden">
        <BlobBack className="absolute -top-10 -left-10" color="accent" size={300} />
        <BlobBack className="absolute -bottom-10 -right-10" color="cat-rent" size={260} />

        <div className="relative w-full max-w-[480px] rounded-2xl border border-line bg-surface text-ink shadow-hero p-8 space-y-6">
          {isHouseholdFull ? (
            <HouseholdCompleteView
              members={household.members}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              recoveryOpen={recoveryOpen}
              setRecoveryOpen={setRecoveryOpen}
              confirmingRegenerate={confirmingRegenerate}
              setConfirmingRegenerate={setConfirmingRegenerate}
              onRegenerate={handleRegenerate}
              regeneratePending={regenerateMutation.isPending}
            />
          ) : (
            <InvitePromptView
              myNickname={myNickname}
              inviteCode={household.inviteCode}
              copied={copied}
              onCopy={handleCopy}
              isAdmin={isAdmin}
              confirmingRegenerate={confirmingRegenerate}
              setConfirmingRegenerate={setConfirmingRegenerate}
              onRegenerate={handleRegenerate}
              regeneratePending={regenerateMutation.isPending}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Household full ────────────────────────────────────────────────────────

interface HouseholdCompleteViewProps {
  members: ReturnType<typeof useDashboard>['household']['members'];
  currentUserId: string;
  isAdmin: boolean;
  recoveryOpen: boolean;
  setRecoveryOpen: (v: boolean) => void;
  confirmingRegenerate: boolean;
  setConfirmingRegenerate: (v: boolean) => void;
  onRegenerate: () => Promise<void>;
  regeneratePending: boolean;
}

function HouseholdCompleteView({
  members,
  currentUserId,
  isAdmin,
  recoveryOpen,
  setRecoveryOpen,
  confirmingRegenerate,
  setConfirmingRegenerate,
  onRegenerate,
  regeneratePending,
}: HouseholdCompleteViewProps) {
  return (
    <>
      {/* Stacked filled avatars — both real members */}
      <div className="flex items-center justify-center -space-x-4">
        {members.slice(0, 4).map((m) => (
          <Avatar
            key={m._id}
            name={m.nickname}
            size={64}
            variant="filled"
            style={{ boxShadow: '0 0 0 4px hsl(var(--surface))' }}
          />
        ))}
      </div>

      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-ink">
          Your household is{' '}
          <span className="font-serif italic text-accent">complete</span>
        </h1>
        <p className="text-sm text-ink-3">
          {members.length} of {members.length} members joined.
        </p>
      </div>

      {/* Member list */}
      <div className="space-y-2">
        <EyebrowLabel as="div">MEMBERS</EyebrowLabel>
        {members.map((m) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m._id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
            >
              <Avatar name={m.nickname} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">
                  {m.nickname}
                  {isMe && (
                    <span className="ml-1.5 text-xs text-ink-3">(you)</span>
                  )}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3 mt-0.5">
                  {m.role}
                  {m.isCreator && ' · creator'}
                </p>
              </div>
              <Check className="h-4 w-4 text-pos shrink-0" aria-label="Joined" />
            </div>
          );
        })}
      </div>

      {/* Admin: code recovery (collapsed by default) */}
      {isAdmin && (
        <div className="pt-2 border-t border-line">
          <button
            type="button"
            onClick={() => setRecoveryOpen(!recoveryOpen)}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${recoveryOpen ? 'rotate-180' : ''}`}
            />
            Code recovery options
          </button>

          {recoveryOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-ink-3 leading-relaxed">
                The invite code isn't actively used now that the household is
                full, but you can regenerate it if you ever shared it where you
                shouldn't have.
              </p>
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
                      onClick={() => void onRegenerate()}
                      disabled={regeneratePending}
                    >
                      {regeneratePending ? (
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
                      disabled={regeneratePending}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Invite prompt (seats remaining) ───────────────────────────────────────

interface InvitePromptViewProps {
  myNickname: string;
  inviteCode: string;
  copied: boolean;
  onCopy: () => void;
  isAdmin: boolean;
  confirmingRegenerate: boolean;
  setConfirmingRegenerate: (v: boolean) => void;
  onRegenerate: () => Promise<void>;
  regeneratePending: boolean;
}

function InvitePromptView({
  myNickname,
  inviteCode,
  copied,
  onCopy,
  isAdmin,
  confirmingRegenerate,
  setConfirmingRegenerate,
  onRegenerate,
  regeneratePending,
}: InvitePromptViewProps) {
  return (
    <>
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
          <span className="font-serif italic text-accent">person</span> in
        </h1>
        <p className="text-sm text-ink-3">
          Share the code below — they'll be set up in seconds.
        </p>
      </div>

      {/* invite code row */}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
        <code className="flex-1 truncate font-mono text-xs text-ink-2 px-2 tracking-wider">
          {inviteCode}
        </code>
        <Button size="sm" onClick={onCopy}>
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
                onClick={() => void onRegenerate()}
                disabled={regeneratePending}
              >
                {regeneratePending ? (
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
                disabled={regeneratePending}
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
    </>
  );
}
