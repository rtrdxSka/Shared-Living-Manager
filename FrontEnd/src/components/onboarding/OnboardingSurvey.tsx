import { useOnboarding } from '@/hooks/useOnboarding';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { SurveyProgress } from './SurveyProgress';
import { StepLivingArrangement } from './steps/StepLivingArrangement';
import { StepHouseholdStructure } from './steps/StepHouseholdStructure';
import { StepFinancialPreferences } from './steps/StepFinancialPreferences';
import { StepTaskPreferences } from './steps/StepTaskPreferences';
import { StepReview } from './steps/StepReview';

// ── Step metadata ─────────────────────────────────────────────────────

const STEP_META: Record<number, { title: string; description: string }> = {
  1: {
    title: 'Living Arrangement',
    description: 'Tell us about your household',
  },
  2: {
    title: 'Household Members',
    description: 'Set up your profile and describe your household',
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

// ── All steps are always active ──────────────────────────────────────

const EFFECTIVE_STEPS = [1, 2, 3, 4, 5];

// ── Wizard container ──────────────────────────────────────────────────

export function OnboardingSurvey() {
  const { currentStep } = useOnboarding();

  const meta = STEP_META[currentStep];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <SurveyProgress
          currentStep={currentStep}
          effectiveSteps={EFFECTIVE_STEPS}
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
          {currentStep === 1 && <StepLivingArrangement />}
          {currentStep === 2 && <StepHouseholdStructure />}
          {currentStep === 3 && <StepFinancialPreferences />}
          {currentStep === 4 && <StepTaskPreferences />}
          {currentStep === 5 && <StepReview />}
        </CardContent>
      </Card>
    </div>
  );
}