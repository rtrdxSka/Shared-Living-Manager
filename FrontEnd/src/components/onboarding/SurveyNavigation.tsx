import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SurveyNavigationProps {
  /** Hide the back button on the first step */
  showBack?: boolean;
  /** Callback for back navigation */
  onBack?: () => void;
  /** Label for the forward button (default: "Continue") */
  nextLabel?: string;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Label shown during submission (default: "Creating...") */
  submittingLabel?: string;
  /** If true, renders as a final submit button instead of "Continue" */
  isFinalStep?: boolean;
}

export function SurveyNavigation({
  showBack = true,
  onBack,
  nextLabel = 'Continue',
  isSubmitting = false,
  submittingLabel = 'Creating...',
  isFinalStep = false,
}: SurveyNavigationProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 rounded-xl text-ink-3 hover:text-ink"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      ) : (
        <div />
      )}

      <Button
        type="submit"
        className="h-11 gap-2 rounded-xl px-6 shadow-sm"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {submittingLabel}
          </>
        ) : isFinalStep ? (
          nextLabel
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
