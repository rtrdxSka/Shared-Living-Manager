import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Plus, UserPlus, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { OnboardingSurvey } from '@/components/onboarding/OnboardingSurvey';
import { FormField } from '@/contexts/FormField';
import { householdApi } from '@/api/household.api';
import { joinHouseholdSchema, type JoinHouseholdFormData } from '@/schemas/household.schemas';
import type { ApiErrorResponse } from '@/types/auth.types';

type GetStartedView = 'choice' | 'create' | 'join';

export default function GetStartedPage() {
  const { user } = useAuth();
  const [view, setView] = useState<GetStartedView>('choice');

  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />

      <div className="relative w-full">
        {view === 'choice' && (
          <ChoiceView
            firstName={user?.firstName}
            onCreateClick={() => setView('create')}
            onJoinClick={() => setView('join')}
          />
        )}

        {view === 'create' && (
          <CreateView onBack={() => setView('choice')} />
        )}

        {view === 'join' && (
          <JoinView onBack={() => setView('choice')} />
        )}
      </div>
    </div>
  );
}

// ── Choice screen ─────────────────────────────────────────────────────

interface ChoiceViewProps {
  firstName?: string;
  onCreateClick: () => void;
  onJoinClick: () => void;
}

function ChoiceView({
  firstName,
  onCreateClick,
  onJoinClick,
}: ChoiceViewProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center">
      <Card className="w-full rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {firstName}!
            </CardTitle>
            <CardDescription className="text-base">
              How would you like to get started?
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-6 pb-8 pt-4 sm:px-8">
          <button
            type="button"
            onClick={onCreateClick}
            className="group flex items-center gap-4 rounded-xl border border-border/60 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Create a household</p>
              <p className="text-sm text-muted-foreground">
                Set up a new household and invite others to join
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onJoinClick}
            className="group flex items-center gap-4 rounded-xl border border-border/60 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Join a household</p>
              <p className="text-sm text-muted-foreground">
                Enter an invite code to join an existing household
              </p>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Create household view (wraps OnboardingSurvey in provider) ────────

function CreateView({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingProvider>
      <div className="mx-auto max-w-2xl">
        <Button
          type="button"
          variant="ghost"
          className="mb-4 h-9 gap-2 rounded-xl text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to options
        </Button>

        <OnboardingSurvey />
      </div>
    </OnboardingProvider>
  );
}

// ── Join household view ───────────────────────────────────────────────

function JoinView({ onBack }: { onBack: () => void }) {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinHouseholdFormData>({
    resolver: zodResolver(joinHouseholdSchema),
    defaultValues: { inviteCode: '' },
  });

  const onSubmit = async (data: JoinHouseholdFormData) => {
    setServerError('');

    try {
      await householdApi.join({ inviteCode: data.inviteCode });
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(
          apiError?.message || 'An error occurred while joining. Please try again.'
        );
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center">
      <Button
        type="button"
        variant="ghost"
        className="mb-4 h-9 gap-2 self-start rounded-xl text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to options
      </Button>

      <Card className="w-full rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <UserPlus className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Join a Household
            </CardTitle>
            <CardDescription className="text-base">
              Enter the invite code shared by your household admin
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5 px-6 pb-8 pt-4 sm:px-8">
            {serverError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FormField
              label="Invite Code"
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              error={errors.inviteCode}
              {...register('inviteCode')}
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base shadow-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Household'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}