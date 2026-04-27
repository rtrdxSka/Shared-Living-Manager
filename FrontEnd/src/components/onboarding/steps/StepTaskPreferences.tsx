import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useOnboarding } from '@/hooks/useOnboarding';
import {
  createStepTaskPreferencesSchema,
  type StepTaskPreferencesData,
} from '@/schemas/onboarding.schemas';
import {
  TASK_MANAGEMENT_OPTIONS,
  TASK_DISTRIBUTION_OPTIONS,
  getAvailableDistributionMethods,
  shouldShowDistributionMethod,
  type TaskManagementLevel,
  type TaskDistributionMethod,
} from '@/types/onboarding.types';
import { Label } from '@/components/ui/label';
import { SurveyNavigation } from '../SurveyNavigation';
import { cn } from '@/lib/utils';

export function StepTaskPreferences() {
  const { surveyState, updateStepData, nextStep, prevStep } = useOnboarding();

  const arrangement = surveyState.step1.livingArrangement;
  const schema = createStepTaskPreferencesSchema(arrangement);

  const {
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<StepTaskPreferencesData>({
    resolver: zodResolver(schema),
    defaultValues: {
      taskManagementEnabled:
        surveyState.step4.taskManagementEnabled || undefined,
      taskDistributionMethod:
        surveyState.step4.taskDistributionMethod || undefined,
    },
  });

  const taskLevel = watch('taskManagementEnabled');
  const showDistribution = shouldShowDistributionMethod(arrangement, taskLevel);
  const availableMethods = getAvailableDistributionMethods(arrangement);
  const filteredDistributionOptions = TASK_DISTRIBUTION_OPTIONS.filter((opt) =>
    availableMethods.includes(opt.value)
  );

  const onSubmit = (data: StepTaskPreferencesData) => {
    updateStepData('step4', {
      taskManagementEnabled: data.taskManagementEnabled,
      taskDistributionMethod: showDistribution
        ? data.taskDistributionMethod ?? ''
        : '',
    });
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Task management level */}
      <Controller
        name="taskManagementEnabled"
        control={control}
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Task management</Label>
            <div className="grid grid-cols-1 gap-2">
              {TASK_MANAGEMENT_OPTIONS.map((option) => {
                const selected = field.value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      field.onChange(option.value as TaskManagementLevel)
                    }
                    className={cn(
                      'w-full text-left rounded-xl border p-4 transition-colors',
                      selected
                        ? 'border-accent bg-accent/[0.06] ring-1 ring-accent/30'
                        : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                          selected ? 'border-accent' : 'border-line'
                        )}
                      >
                        {selected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{option.label}</p>
                        {option.description && (
                          <p className="text-xs text-ink-3 mt-0.5">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.taskManagementEnabled && (
              <p className="text-sm text-destructive">
                {errors.taskManagementEnabled.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Distribution method — shown only when tasks enabled + not alone */}
      {showDistribution && (
        <Controller
          name="taskDistributionMethod"
          control={control}
          render={({ field }) => (
            <div className="space-y-2">
              <Label>Task distribution method</Label>
              <div className="grid grid-cols-1 gap-2">
                {filteredDistributionOptions.map((option) => {
                  const selected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        field.onChange(
                          option.value as TaskDistributionMethod
                        )
                      }
                      className={cn(
                        'w-full text-left rounded-xl border p-4 transition-colors',
                        selected
                          ? 'border-accent bg-accent/[0.06] ring-1 ring-accent/30'
                          : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                            selected ? 'border-accent' : 'border-line'
                          )}
                        >
                          {selected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          )}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-ink">{option.label}</p>
                          {option.description && (
                            <p className="text-xs text-ink-3 mt-0.5">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.taskDistributionMethod && (
                <p className="text-sm text-destructive">
                  {errors.taskDistributionMethod.message}
                </p>
              )}
            </div>
          )}
        />
      )}

      <SurveyNavigation showBack onBack={prevStep} />
    </form>
  );
}