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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="mb-1 text-base font-semibold">Configure Rotation</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Select who starts the rotation. The order follows member positions and advances every 7 days.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Starts with</label>
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
          {error && <p className="text-xs text-destructive">{error}</p>}
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
