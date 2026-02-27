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
        ? data.taskDistributionMethod
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
              {TASK_MANAGEMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    field.onChange(option.value as TaskManagementLevel)
                  }
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    field.value === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-border hover:bg-muted/30'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      field.value === option.value
                        ? 'border-primary'
                        : 'border-muted-foreground/40'
                    )}
                  >
                    {field.value === option.value && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <div>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        field.value === option.value
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {option.label}
                    </p>
                    {option.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
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
                {filteredDistributionOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      field.onChange(
                        option.value as TaskDistributionMethod
                      )
                    }
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      field.value === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        field.value === option.value
                          ? 'border-primary'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {field.value === option.value && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          field.value === option.value
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.label}
                      </p>
                      {option.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
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