import { Pencil } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { householdApi } from '@/api/household.api';
import {
  LIVING_ARRANGEMENT_OPTIONS,
  RELATIONSHIP_OPTIONS,
  AGE_GROUP_OPTIONS,
  EXPENSE_SPLIT_METHOD_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  TASK_MANAGEMENT_OPTIONS,
  TASK_DISTRIBUTION_OPTIONS,
  shouldShowSplitMethod,
  shouldShowDistributionMethod,
} from '@/types/onboarding.types';
import { Button } from '@/components/ui/button';
import { SurveyNavigation } from '../SurveyNavigation';

// ── Label lookup helpers ──────────────────────────────────────────────

function findLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T | ''
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

// ── Component ─────────────────────────────────────────────────────────

export function StepReview() {
  const { refreshUser } = useAuth();
  const {
    surveyState,
    isSubmitting,
    setIsSubmitting,
    buildSubmitPayload,
    prevStep,
    goToStep,
    resetSurvey,
  } = useOnboarding();

  const navigate = useNavigate();

  const { step1, step2, step3, step4 } = surveyState;
  const arrangement = step1.livingArrangement;
  const showSplit = shouldShowSplitMethod(arrangement);
  const showDistribution = shouldShowDistributionMethod(
    arrangement,
    step4.taskManagementEnabled
  );

  const handleSubmit = async () => {
    const payload = buildSubmitPayload();
    if (!payload) return;

    setIsSubmitting(true);
    try {
      await householdApi.create(payload);
      await refreshUser();
      resetSurvey();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Failed to create household:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Living Arrangement */}
      <ReviewSection title="Living Arrangement" onEdit={() => goToStep(1)}>
        <ReviewRow label="Household name" value={step1.householdName} />
        <ReviewRow
          label="Living arrangement"
          value={findLabel(LIVING_ARRANGEMENT_OPTIONS, arrangement)}
        />
        {arrangement === 'other' && step1.livingArrangementOther && (
          <ReviewRow label="Description" value={step1.livingArrangementOther} />
        )}
        <ReviewRow
          label="Total members"
          value={String(step1.totalMembers)}
        />
      </ReviewSection>

      {/* Step 2: Household Structure */}
      <ReviewSection title="Household Members" onEdit={() => goToStep(2)}>
        {/* Creator */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
          <p className="font-medium">
            {step2.creatorProfile.nickname || '—'}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (you)
            </span>
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {findLabel(AGE_GROUP_OPTIONS, step2.creatorProfile.ageGroup)}
            {step2.creatorProfile.familyGroup &&
              ` · ${step2.creatorProfile.familyGroup}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              step2.creatorProfile.participatesInFinances && 'Finances',
              step2.creatorProfile.participatesInTasks && 'Tasks',
            ]
              .filter(Boolean)
              .join(', ') || 'No participation'}
          </p>
        </div>

        {/* Other members */}
        {step2.memberStructure.length > 0 && (
          <div className="space-y-3">
            {step2.memberStructure.map((member, i) => (
              <div
                key={i}
                className="rounded-lg bg-muted/30 px-3 py-2.5 text-sm"
              >
                <p className="font-medium">{member.nickname}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {findLabel(RELATIONSHIP_OPTIONS, member.relationship)}
                  {' · '}
                  {findLabel(AGE_GROUP_OPTIONS, member.ageGroup)}
                  {member.familyGroup && ` · ${member.familyGroup}`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    member.participatesInFinances && 'Finances',
                    member.participatesInTasks && 'Tasks',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No participation'}
                </p>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      {/* Step 3: Financial Preferences */}
      <ReviewSection title="Financial Preferences" onEdit={() => goToStep(3)}>
        {showSplit && (
          <ReviewRow
            label="Split method"
            value={findLabel(
              EXPENSE_SPLIT_METHOD_OPTIONS,
              step3.expenseSplitMethod
            )}
          />
        )}
        <ReviewRow
          label="Tracked expenses"
          value={step3.trackedExpenseTypes
            .map((t) => findLabel(EXPENSE_TYPE_OPTIONS, t))
            .join(', ')}
        />
        <ReviewRow
          label="Currency"
          value={findLabel(CURRENCY_OPTIONS, step3.currency)}
        />
      </ReviewSection>

      {/* Step 4: Task Preferences */}
      <ReviewSection title="Task Preferences" onEdit={() => goToStep(4)}>
        <ReviewRow
          label="Task management"
          value={findLabel(
            TASK_MANAGEMENT_OPTIONS,
            step4.taskManagementEnabled
          )}
        />
        {showDistribution && (
          <ReviewRow
            label="Distribution method"
            value={findLabel(
              TASK_DISTRIBUTION_OPTIONS,
              step4.taskDistributionMethod
            )}
          />
        )}
      </ReviewSection>

      {/* Navigation */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <SurveyNavigation
          showBack
          onBack={prevStep}
          nextLabel="Create Household"
          isFinalStep
          isSubmitting={isSubmitting}
          submittingLabel="Creating..."
        />
      </form>
    </div>
  );
}

// ── Review section with Edit button ───────────────────────────────────

interface ReviewSectionProps {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}

function ReviewSection({ title, onEdit, children }: ReviewSectionProps) {
  return (
    <div className="rounded-xl border border-border/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ── Single review row ─────────────────────────────────────────────────

interface ReviewRowProps {
  label: string;
  value: string;
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">
        {value || '—'}
      </span>
    </div>
  );
}