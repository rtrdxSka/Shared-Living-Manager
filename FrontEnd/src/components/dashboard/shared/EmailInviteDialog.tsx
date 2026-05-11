import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSendInviteEmail } from '@/hooks/queries';
import { extractApiError } from '@/utils/extractApiError';

interface EmailInviteDialogProps {
  householdId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX = 200;

export default function EmailInviteDialog({
  householdId,
  open,
  onOpenChange,
}: EmailInviteDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sendMutation = useSendInviteEmail(householdId);
  const submitting = sendMutation.isPending;

  // Reset all transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setRecipientEmail('');
      setPersonalNote('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  // ESC closes when not in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onOpenChange]);

  if (!open) return null;

  const titleId = 'email-invite-title';
  const descId = 'email-invite-description';

  const trimmedEmail = recipientEmail.trim();
  const trimmedNote = personalNote.trim();
  const emailValid = EMAIL_REGEX.test(trimmedEmail);
  const noteValid = trimmedNote.length <= NOTE_MAX;
  const canSubmit = emailValid && noteValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await sendMutation.mutateAsync({
        recipientEmail: trimmedEmail,
        ...(trimmedNote.length > 0 && { personalNote: trimmedNote }),
      });
      setSuccess(true);
      // Brief success indication, then auto-close.
      window.setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      setError(extractApiError(err, 'Failed to send invite. Please try again.'));
    }
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold">
          Send invite by email
        </h2>
        <p id={descId} className="mt-1 text-sm text-muted-foreground">
          We'll email them a magic link plus the invite code.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="invite-recipient-email"
              className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3"
            >
              RECIPIENT EMAIL
            </label>
            <Input
              id="invite-recipient-email"
              type="email"
              autoComplete="email"
              placeholder="person@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div>
            <label
              htmlFor="invite-personal-note"
              className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3"
            >
              PERSONAL NOTE (OPTIONAL)
            </label>
            <textarea
              id="invite-personal-note"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Hey — come share groceries with me!"
              className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-ink-3 text-right">
              {trimmedNote.length}/{NOTE_MAX}
            </p>
          </div>

          {error && (
            <p className="text-sm text-neg" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-1.5 text-sm text-pos" role="status">
              <Check className="h-4 w-4" />
              Invite sent.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
