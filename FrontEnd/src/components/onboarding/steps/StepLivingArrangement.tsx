import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus } from 'lucide-react';

import { useOnboarding } from '@/hooks/useOnboarding';
import {
  stepLivingArrangementSchema,
  type StepLivingArrangementData,
} from '@/schemas/onboarding.schemas';
import {
  LIVING_ARRANGEMENT_OPTIONS,
  getMemberCountConstraints,
  type LivingArrangement,
} from '@/types/onboarding.types';
import { FormField } from '@/contexts/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SurveyNavigation } from '../SurveyNavigation';
import { cn } from '@/lib/utils';

export function StepLivingArrangement() {
  const { surveyState, updateStepData, nextStep } = useOnboarding();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StepLivingArrangementData>({
    resolver: zodResolver(stepLivingArrangementSchema),
    defaultValues: {
      householdName: surveyState.step1.householdName,
      totalMembers: surveyState.step1.totalMembers,
      livingArrangement: surveyState.step1.livingArrangement || undefined,
      livingArrangementOther: surveyState.step1.livingArrangementOther,
    },
  });

  const selectedArrangement = watch('livingArrangement');
  const totalMembers = watch('totalMembers');
  const constraints = getMemberCountConstraints(selectedArrangement ?? '');

  // Auto-adjust totalMembers when arrangement changes
  useEffect(() => {
    if (!selectedArrangement) return;

    const { min, max, fixed } = constraints;

    if (fixed !== undefined) {
      // Locked value (alone = 1, couple = 2)
      if (totalMembers !== fixed) {
        setValue('totalMembers', fixed, { shouldValidate: true });
      }
    } else if (totalMembers < min) {
      setValue('totalMembers', min, { shouldValidate: true });
    } else if (totalMembers > max) {
      setValue('totalMembers', max, { shouldValidate: true });
    }
    // Only react to arrangement changes, not every totalMembers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArrangement]);

  const onSubmit = (data: StepLivingArrangementData) => {
    updateStepData('step1', {
      householdName: data.householdName,
      totalMembers: data.totalMembers,
      livingArrangement: data.livingArrangement,
      livingArrangementOther: data.livingArrangementOther ?? '',
    });
    nextStep();
  };

  const isStepperLocked = constraints.fixed !== undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Household name */}
      <FormField
        label="Household name"
        type="text"
        placeholder="e.g. Our Apartment"
        autoComplete="off"
        error={errors.householdName}
        {...register('householdName')}
      />

      {/* Living arrangement — radio cards */}
      <Controller
        name="livingArrangement"
        control={control}
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Living arrangement</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LIVING_ARRANGEMENT_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  label={option.label}
                  selected={field.value === option.value}
                  onClick={() =>
                    field.onChange(option.value as LivingArrangement)
                  }
                />
              ))}
            </div>
            {errors.livingArrangement && (
              <p className="text-sm text-destructive">
                {errors.livingArrangement.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Conditional: 'Other' description */}
      {selectedArrangement === 'other' && (
        <FormField
          label="Please describe your arrangement"
          type="text"
          placeholder="e.g. Living with extended family"
          error={errors.livingArrangementOther}
          {...register('livingArrangementOther')}
        />
      )}

      {/* Total members — stepper */}
      <Controller
        name="totalMembers"
        control={control}
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Total members (including you)</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() =>
                  field.onChange(
                    Math.max(constraints.min, field.value - 1)
                  )
                }
                disabled={isStepperLocked || field.value <= constraints.min}
              >
                <Minus className="h-4 w-4" />
              </Button>

              <Input
                type="number"
                inputMode="numeric"
                min={constraints.min}
                max={constraints.max}
                className={cn(
                  'h-10 w-20 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                  errors.totalMembers && 'border-destructive'
                )}
                value={field.value}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    field.onChange(
                      Math.min(constraints.max, Math.max(constraints.min, val))
                    );
                  }
                }}
                disabled={isStepperLocked}
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() =>
                  field.onChange(
                    Math.min(constraints.max, field.value + 1)
                  )
                }
                disabled={isStepperLocked || field.value >= constraints.max}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isStepperLocked && (
              <p className="text-xs text-muted-foreground">
                Member count is set automatically for this arrangement
              </p>
            )}

            {errors.totalMembers && (
              <p className="text-sm text-destructive">
                {errors.totalMembers.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Navigation — Step 1 has no Back button */}
      <SurveyNavigation showBack={false} />
    </form>
  );
}

// ── Radio card ────────────────────────────────────────────────────────

interface RadioCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function RadioCard({ label, selected, onClick }: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-colors',
        selected
          ? 'border-accent bg-accent/[0.06] ring-1 ring-accent/30'
          : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2'
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
            selected ? 'border-accent' : 'border-line'
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
        </span>
        <p className="text-sm font-medium text-ink">{label}</p>
      </div>
    </button>
  );
}