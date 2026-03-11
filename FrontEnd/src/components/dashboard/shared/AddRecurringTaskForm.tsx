import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { recurringTaskApi } from '@/api/recurring-task.api';
import type { RecurrenceInterval } from '@/types/recurring-task.types';

interface AddRecurringTaskFormProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  distributionMethod?: string;
  taskMembers?: { _id: string; nickname: string }[];
}

export default function AddRecurringTaskForm({
  householdId,
  open,
  onOpenChange,
  onCreated,
  distributionMethod,
  taskMembers = [],
}: AddRecurringTaskFormProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [interval, setInterval] = useState<RecurrenceInterval>('weekly');
  const [assignedToMemberId, setAssignedToMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAssigneeSelect = distributionMethod === 'fixed' && taskMembers.length > 0;

  useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      setInterval('weekly');
      setAssignedToMemberId('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await recurringTaskApi.create(householdId, {
        title: title.trim(),
        ...(notes.trim() && { notes: notes.trim() }),
        interval,
        ...(showAssigneeSelect && assignedToMemberId && { assignedToMemberId }),
      });
      onCreated();
      onOpenChange(false);
    } catch {
      setError('Failed to create recurring task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Recurring Task</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="e.g. Take out trash"
              required
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Notes <span className="text-muted-foreground">(optional)</span></label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Any details…"
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Repeats</label>
            <Select
              value={interval}
              onValueChange={(v) => setInterval(v as RecurrenceInterval)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showAssigneeSelect && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Assign to <span className="text-muted-foreground">(optional)</span></label>
              <Select
                value={assignedToMemberId || '__none__'}
                onValueChange={(v) => setAssignedToMemberId(v === '__none__' ? '' : v)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {taskMembers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>{m.nickname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Recurring Task'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
