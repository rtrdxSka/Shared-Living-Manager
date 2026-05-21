import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDashboard } from '@/contexts/useDashboard';
import { useCreateIssue } from '@/hooks/queries/useIssueQueries';
import {
  ISSUE_CATEGORIES,
  type IssueCategory,
} from '@/types/issue.types';
import { extractApiError } from '@/utils/extractApiError';

interface NewIssueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewIssueSheet({ open, onOpenChange }: NewIssueSheetProps) {
  const { household } = useDashboard();
  const createIssue = useCreateIssue(household._id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<IssueCategory>('cleaning');
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever the sheet closes so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      setTitle('');
      setBody('');
      setCategory('cleaning');
      setError(null);
    }
  }, [open]);

  const canSubmit =
    title.trim().length > 0 && body.trim().length > 0 && !createIssue.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    try {
      await createIssue.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        category,
      });
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, 'Failed to post issue. Please try again.'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Raise an issue</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label
              htmlFor="issue-title"
              className="block text-sm font-medium mb-1"
            >
              Title
            </label>
            <Input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Brief headline (e.g. Dishes in the sink)"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="issue-body"
              className="block text-sm font-medium mb-1"
            >
              Details
            </label>
            <textarea
              id="issue-body"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={5}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's going on?"
            />
          </div>

          <div>
            <label
              htmlFor="issue-category"
              className="block text-sm font-medium mb-1"
            >
              Category
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as IssueCategory)}
            >
              <SelectTrigger id="issue-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createIssue.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createIssue.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {createIssue.isPending ? 'Posting…' : 'Post anonymously'}
            </Button>
          </div>

          <p className="text-xs text-ink-3">
            Your post is anonymous to other roommates. Only admins can reveal
            authorship if needed.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
