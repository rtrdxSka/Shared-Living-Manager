import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VOTE_THRESHOLDS, type VoteThreshold } from '@/types/vote.types';

export interface VoteProposalFormValues {
  proposedRuleTitle: string;
  proposedRuleText: string;
  threshold: VoteThreshold;
  deadlineDays: number;
}

interface VoteProposalFormProps {
  initialTitle?: string;
  initialText?: string;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onCancel?: () => void;
  onSubmit: (input: VoteProposalFormValues) => void | Promise<void>;
}

const THRESHOLD_LABELS: Record<VoteThreshold, string> = {
  simple_majority: 'Simple majority (>50% of yes/no)',
  supermajority: 'Supermajority (≥66.7%)',
  unanimous: 'Unanimous (100%)',
};

const MIN_DEADLINE_DAYS = 1;
const MAX_DEADLINE_DAYS = 30;

export function VoteProposalForm({
  initialTitle = '',
  initialText = '',
  submitLabel,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: VoteProposalFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [threshold, setThreshold] = useState<VoteThreshold>('simple_majority');
  const [deadlineDays, setDeadlineDays] = useState<number>(7);

  const trimmedTitle = title.trim();
  const trimmedText = text.trim();
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedText.length > 0 &&
    Number.isInteger(deadlineDays) &&
    deadlineDays >= MIN_DEADLINE_DAYS &&
    deadlineDays <= MAX_DEADLINE_DAYS &&
    !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      proposedRuleTitle: trimmedTitle,
      proposedRuleText: trimmedText,
      threshold,
      deadlineDays,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div>
        <label
          htmlFor="proposed-rule-title"
          className="block text-sm font-medium mb-1"
        >
          Proposed rule title
        </label>
        <Input
          id="proposed-rule-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Dishes within 24h"
          autoFocus
        />
      </div>

      <div>
        <label
          htmlFor="proposed-rule-text"
          className="block text-sm font-medium mb-1"
        >
          Rule details
        </label>
        <textarea
          id="proposed-rule-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Each person cleans within 24h of using the dishes."
        />
      </div>

      <div>
        <span className="block text-sm font-medium mb-1">Threshold</span>
        <div className="space-y-1">
          {VOTE_THRESHOLDS.map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="radio"
                name="vote-threshold"
                value={t}
                checked={threshold === t}
                onChange={() => setThreshold(t)}
              />
              {THRESHOLD_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="deadline-days"
          className="block text-sm font-medium mb-1"
        >
          Deadline (days)
        </label>
        <Input
          id="deadline-days"
          type="number"
          min={MIN_DEADLINE_DAYS}
          max={MAX_DEADLINE_DAYS}
          value={deadlineDays}
          onChange={(e) =>
            setDeadlineDays(parseInt(e.target.value || '0', 10))
          }
          className="w-24"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Vote closes after this many days ({MIN_DEADLINE_DAYS}–
          {MAX_DEADLINE_DAYS}).
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Submitting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
