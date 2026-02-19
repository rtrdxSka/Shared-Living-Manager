import { useOnboarding } from '@/hooks/useOnboarding';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { SurveyProgress } from './SurveyProgress';
import { shouldSkipMemberStep } from '@/types/onboarding.types';

// ── Step metadata ─────────────────────────────────────────────────────

const STEP_META: Record<number, { title: string; description: string }> = {
  1: {
    title: 'Living Arrangement',
    description: 'Tell us about your household',
  },
  2: {
    title: 'Household Members',
    description: 'Describe who you live with',
  },
  3: {
    title: 'Financial Preferences',
    description: 'How should expenses be managed',
  },
  4: {
    title: 'Task Preferences',
    description: 'How should chores be handled',
  },
  5: {
    title: 'Review & Confirm',
    description: 'Check everything before creating your household',
  },
};

// ── Effective steps helper ────────────────────────────────────────────

function getEffectiveSteps(arrangement: string): number[] {
  const steps = [1, 2, 3, 4, 5];
  if (shouldSkipMemberStep(arrangement as never)) {
    return steps.filter((s) => s !== 2);
  }
  return steps;
}

// ── Wizard container ──────────────────────────────────────────────────

export function OnboardingSurvey() {
  const { currentStep, surveyState } = useOnboarding();

  const effectiveSteps = getEffectiveSteps(
    surveyState.step1.livingArrangement
  );
  const meta = STEP_META[currentStep];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <SurveyProgress
          currentStep={currentStep}
          effectiveSteps={effectiveSteps}
        />
      </div>

      {/* Step card */}
      <Card className="rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-1 px-6 pb-2 pt-6 sm:px-8">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {meta.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {meta.description}
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-4 sm:px-8">
          {/*
            Each step is a self-contained form component that:
            - Renders its own fields
            - Validates via react-hook-form + zod on submit
            - Renders Back / Continue buttons
            - Calls updateStepData() + nextStep() on valid submit

            Placeholders below — replaced as steps are implemented.
          */}
          {currentStep === 1 && <StepPlaceholder step={1} />}
          {currentStep === 2 && <StepPlaceholder step={2} />}
          {currentStep === 3 && <StepPlaceholder step={3} />}
          {currentStep === 4 && <StepPlaceholder step={4} />}
          {currentStep === 5 && <StepPlaceholder step={5} />}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Temporary placeholder (removed as real steps are built) ───────────

function StepPlaceholder({ step }: { step: number }) {
  const meta = STEP_META[step];
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-lg font-bold text-muted-foreground">
        {step}
      </div>
      <p className="text-sm text-muted-foreground">
        {meta.title} — component pending
      </p>
    </div>
  );
}