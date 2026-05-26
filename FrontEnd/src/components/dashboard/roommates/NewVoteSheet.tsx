import { useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDashboard } from '@/contexts/useDashboard';
import { useCreateVote } from '@/hooks/queries/useVoteQueries';
import { extractApiError } from '@/utils/extractApiError';

import { VoteProposalForm } from './VoteProposalForm';

interface NewVoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewVoteSheet({ open, onOpenChange }: NewVoteSheetProps) {
  const { household } = useDashboard();
  const createVote = useCreateVote(household._id);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state on close so the next open is fresh.
  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Propose a new rule</SheetTitle>
        </SheetHeader>

        <p className="text-sm text-ink-3 mt-2 mb-4">
          Start a vote on a rule everyone should agree to. Once it passes, it
          becomes an official house rule.
        </p>

        <VoteProposalForm
          submitLabel="Start vote"
          isSubmitting={createVote.isPending}
          errorMessage={error}
          onCancel={() => handleOpenChange(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              await createVote.mutateAsync(input);
              handleOpenChange(false);
            } catch (err) {
              setError(extractApiError(err, 'Failed to start vote.'));
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
