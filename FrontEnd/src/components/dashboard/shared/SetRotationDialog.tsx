import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import type { HouseholdMemberResponse } from '@/types/household.types';

interface SetRotationDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskMembers: HouseholdMemberResponse[];
  onConfirm: (startMemberId: string) => Promise<void>;
}

export default function SetRotationDialog({
  open,
  onOpenChange,
  taskMembers,
  onConfirm,
}: SetRotationDialogProps) {
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && taskMembers.length > 0) {
      setSelectedId(taskMembers[0]._id);
      setError(null);
    }
  }, [open, taskMembers]);

  if (!open) return null;

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedId);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, 'Failed to configure rotation. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-surface border border-line rounded-2xl shadow-hero p-6 max-w-md w-full mx-4">
        <EyebrowLabel as="div" className="mb-2 text-ink-3">Task Rotation</EyebrowLabel>
        <h2 className="mb-1 text-base font-semibold text-ink">Configure Rotation</h2>
        <p className="mb-4 text-sm text-ink-3">
          Select who starts the rotation. The order follows member positions and advances every 7 days.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              STARTS WITH
            </label>
            <Select value={selectedId} onValueChange={setSelectedId} disabled={submitting}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskMembers.map((m) => (
                  <SelectItem key={m._id} value={m._id}>{m.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-neg mt-1">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={!selectedId || submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
