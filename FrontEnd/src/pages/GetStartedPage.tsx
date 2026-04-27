import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlobBack } from '@/components/ui/blob-back';
import { useAuth } from '@/hooks/useAuth';
import { Home, Users, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { OnboardingSurvey } from '@/components/onboarding/OnboardingSurvey';
import { householdApi } from '@/api/household.api';
import { joinHouseholdSchema, type JoinHouseholdFormData } from '@/schemas/household.schemas';
import type { ApiErrorResponse } from '@/types/auth.types';

type GetStartedView = 'choice' | 'create' | 'join';

export default function GetStartedPage() {
  const { user } = useAuth();
  const [view, setView] = useState<GetStartedView>('choice');

  return (
    <>
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
    </>
  );
}

// ── Choice screen ─────────────────────────────────────────────────────

interface ChoiceViewProps {
  firstName?: string;
  onCreateClick: () => void;
  onJoinClick: () => void;
}

function ChoiceView({ firstName, onCreateClick, onJoinClick }: ChoiceViewProps) {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 overflow-hidden">
      <BlobBack className="absolute -top-10 -left-10" color="accent" size={320} />
      <BlobBack className="absolute -bottom-10 -right-10" color="cat-rent" size={280} />

      <div className="relative w-full max-w-[480px] rounded-2xl border border-line bg-surface text-ink shadow-hero p-8 space-y-6">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <span className="text-accent-ink font-mono font-semibold text-sm">H</span>
          </div>
          <span className="text-sm font-semibold text-ink">HouseMate</span>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">
            Welcome{firstName ? `, ${firstName}` : ''}{' '}
            <span className="font-serif italic text-accent">home</span>
          </h1>
          <p className="text-sm text-ink-3">How would you like to get started?</p>
        </div>

        {/* Option cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCreateClick}
            className="rounded-xl border border-line bg-surface hover:border-line-2 hover:bg-surface-2 p-5 text-left transition-colors"
          >
            <Home className="h-6 w-6 text-accent mb-3" />
            <p className="text-sm font-semibold text-ink">Create a household</p>
            <p className="text-xs text-ink-3 mt-1">Start fresh and invite your person</p>
          </button>

          <button
            type="button"
            onClick={onJoinClick}
            className="rounded-xl border border-line bg-surface hover:border-line-2 hover:bg-surface-2 p-5 text-left transition-colors"
          >
            <Users className="h-6 w-6 text-accent mb-3" />
            <p className="text-sm font-semibold text-ink">Join a household</p>
            <p className="text-xs text-ink-3 mt-1">Use an invite link from your partner</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create household view (wraps OnboardingSurvey in provider) ────────

function CreateView({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingProvider>
      <div className="mx-auto max-w-2xl px-4">
        <button
          type="button"
          onClick={onBack}
          className="mt-6 mb-4 flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to options
        </button>

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
        const status = error.response?.status;
        const apiError = error.response?.data as ApiErrorResponse | undefined;

        if (status === 409 && apiError?.message?.includes('full capacity')) {
          setServerError(
            'This household is already full. Ask the household admin to remove a member or update the household size before trying again.'
          );
        } else {
          setServerError(
            apiError?.message || 'An error occurred while joining. Please try again.'
          );
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 overflow-hidden">
      <BlobBack className="absolute -top-10 -left-10" color="accent" size={320} />
      <BlobBack className="absolute -bottom-10 -right-10" color="cat-rent" size={280} />

      <div className="relative w-full max-w-[480px] rounded-2xl border border-line bg-surface text-ink shadow-hero p-8 space-y-6">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <span className="text-accent-ink font-mono font-semibold text-sm">H</span>
          </div>
          <span className="text-sm font-semibold text-ink">HouseMate</span>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">
            Join a{' '}
            <span className="font-serif italic text-accent">household</span>
          </h1>
          <p className="text-sm text-ink-3">Paste your invite code or link.</p>
        </div>

        {/* Server error */}
        {serverError && (
          <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-xs text-neg">
            {serverError}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Invite code */}
          <div>
            <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              Invite Code
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
                <KeyRound className="h-4 w-4" />
              </span>
              <Input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
                className="pl-10"
                {...register('inviteCode')}
              />
            </div>
            {errors.inviteCode && (
              <p className="text-xs text-neg mt-1">{errors.inviteCode.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full shadow-accent-glow"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining…
              </>
            ) : (
              'Join →'
            )}
          </Button>
        </form>

        {/* Back link */}
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to options
        </button>
      </div>
    </div>
  );
}
