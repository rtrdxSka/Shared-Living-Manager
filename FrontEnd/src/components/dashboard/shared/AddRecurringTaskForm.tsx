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
import { useCreateRecurringTask } from '@/hooks/queries';
import { RECURRENCE_INTERVALS, type RecurrenceInterval } from '@/types/recurring-task.types';

interface AddRecurringTaskFormProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  distributionMethod?: string;
  taskMembers?: { _id: string; nickname: string }[];
}

export default function AddRecurringTaskForm({
  householdId,
  open,
  onOpenChange,
  distributionMethod,
  taskMembers = [],
}: AddRecurringTaskFormProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [interval, setInterval] = useState<RecurrenceInterval>('weekly');
  const [assignedToMemberId, setAssignedToMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createRecurringTaskMutation = useCreateRecurringTask(householdId);

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
    setError(null);
    try {
      await createRecurringTaskMutation.mutateAsync({
        title: title.trim(),
        ...(notes.trim() && { notes: notes.trim() }),
        interval,
        ...(showAssigneeSelect && assignedToMemberId && { assignedToMemberId }),
      });
      onOpenChange(false);
    } catch {
      setError('Failed to create recurring task. Please try again.');
    }
  }

  const canSubmit = title.trim().length > 0 && !createRecurringTaskMutation.isPending;

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
              disabled={createRecurringTaskMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Notes <span className="text-muted-foreground">(optional)</span></label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Any details…"
              disabled={createRecurringTaskMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Repeats</label>
            <Select
              value={interval}
              onValueChange={(v) => setInterval(v as RecurrenceInterval)}
              disabled={createRecurringTaskMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_INTERVALS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showAssigneeSelect && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Assign to <span className="text-muted-foreground">(optional)</span></label>
              <Select
                value={assignedToMemberId || '__none__'}
                onValueChange={(v) => setAssignedToMemberId(v === '__none__' ? '' : v)}
                disabled={createRecurringTaskMutation.isPending}
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
            {createRecurringTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Recurring Task'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
