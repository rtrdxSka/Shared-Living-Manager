import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useOnboarding } from '@/hooks/useOnboarding';
import {
  createStepFinancialPreferencesSchema,
  type StepFinancialPreferencesData,
} from '@/schemas/onboarding.schemas';
import {
  FINANCE_MODE_OPTIONS,
  EXPENSE_SPLIT_METHOD_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  getAvailableSplitMethods,
  type FinanceMode,
  type ExpenseSplitMethod,
  type ExpenseType,
  type Currency,
} from '@/types/onboarding.types';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SurveyNavigation } from '../SurveyNavigation';
import { cn } from '@/lib/utils';

export function StepFinancialPreferences() {
  const { surveyState, updateStepData, nextStep, prevStep } = useOnboarding();

  const arrangement = surveyState.step1.livingArrangement;
  const isNonSolo = arrangement !== 'alone';
  const availableMethods = getAvailableSplitMethods(arrangement);
  const schema = createStepFinancialPreferencesSchema(arrangement);

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StepFinancialPreferencesData>({
    resolver: zodResolver(schema),
    defaultValues: {
      financeMode: surveyState.step3.financeMode || undefined,
      expenseSplitMethod: surveyState.step3.expenseSplitMethod || undefined,
      trackedExpenseTypes: surveyState.step3.trackedExpenseTypes,
      currency: surveyState.step3.currency,
    },
  });

  const watchedFinanceMode = watch('financeMode');
  const showSplitMethod = isNonSolo && watchedFinanceMode === 'split';

  // Reset split method when switching to joint pool
  useEffect(() => {
    if (watchedFinanceMode === 'joint') {
      setValue('expenseSplitMethod', '');
    }
  }, [watchedFinanceMode, setValue]);

  const filteredSplitOptions = EXPENSE_SPLIT_METHOD_OPTIONS.filter((opt) =>
    availableMethods.includes(opt.value)
  );

  const onSubmit = (data: StepFinancialPreferencesData) => {
    updateStepData('step3', {
      financeMode: data.financeMode ?? '',
      expenseSplitMethod: data.expenseSplitMethod ?? '',
      trackedExpenseTypes: data.trackedExpenseTypes,
      currency: data.currency,
    });
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Finance mode toggle — hidden for solo */}
      {isNonSolo && (
        <Controller
          name="financeMode"
          control={control}
          render={({ field }) => (
            <div className="space-y-2">
              <Label>How will you manage household expenses?</Label>
              <div className="grid grid-cols-1 gap-2">
                {FINANCE_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => field.onChange(option.value as FinanceMode)}
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
              {errors.financeMode && (
                <p className="text-sm text-destructive">
                  {errors.financeMode.message}
                </p>
              )}
            </div>
          )}
        />
      )}

      {/* Expense split method — only shown when financeMode === 'split' */}
      {showSplitMethod && (
        <Controller
          name="expenseSplitMethod"
          control={control}
          render={({ field }) => (
            <div className="space-y-2">
              <Label>Expense split method</Label>
              <div className="grid grid-cols-1 gap-2">
                {filteredSplitOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      field.onChange(option.value as ExpenseSplitMethod)
                    }
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      field.value === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    {/* Radio dot */}
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
              {errors.expenseSplitMethod && (
                <p className="text-sm text-destructive">
                  {errors.expenseSplitMethod.message}
                </p>
              )}
            </div>
          )}
        />
      )}

      {/* Tracked expense types — checkbox grid */}
      <Controller
        name="trackedExpenseTypes"
        control={control}
        render={({ field }) => {
          const toggle = (value: ExpenseType) => {
            const current = field.value as ExpenseType[];
            const next = current.includes(value)
              ? current.filter((v) => v !== value)
              : [...current, value];
            field.onChange(next);
          };

          return (
            <div className="space-y-2">
              <Label>Expense types to track</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXPENSE_TYPE_OPTIONS.map((option) => {
                  const checked = (field.value as ExpenseType[]).includes(
                    option.value
                  );
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                        checked
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30'
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(option.value)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {errors.trackedExpenseTypes && (
                <p className="text-sm text-destructive">
                  {errors.trackedExpenseTypes.message}
                </p>
              )}
            </div>
          );
        }}
      />

      {/* Currency */}
      <Controller
        name="currency"
        control={control}
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Currency</Label>
            <div className="flex flex-wrap gap-2">
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => field.onChange(option.value as Currency)}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                    field.value === option.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errors.currency && (
              <p className="text-sm text-destructive">
                {errors.currency.message}
              </p>
            )}
          </div>
        )}
      />

      <SurveyNavigation showBack onBack={prevStep} />
    </form>
  );
}