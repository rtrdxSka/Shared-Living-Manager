import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { BlobBack } from '@/components/ui/blob-back';
import type { ApiErrorResponse } from '@/types/auth.types';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage('No verification token provided');
      setState('error');
      return;
    }

    if (hasVerified.current) return;
    hasVerified.current = true;

    // Remove token from URL so it doesn't linger in browser history
    window.history.replaceState(null, '', window.location.pathname);

    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        setState('success');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const apiError = error.response?.data as ApiErrorResponse | undefined;
          setErrorMessage(apiError?.message || 'Verification failed. The link may have expired.');
        } else {
          setErrorMessage('An unexpected error occurred.');
        }
        setState('error');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 overflow-hidden">
      <BlobBack className="absolute -top-10 -left-10" color="accent" size={320} />
      <BlobBack className="absolute -bottom-10 -right-10" color="cat-rent" size={280} />

      <div className="relative w-full max-w-[420px] rounded-2xl border border-line bg-surface text-ink shadow-hero p-8 space-y-6">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <span className="text-accent-ink font-mono font-semibold text-sm">H</span>
          </div>
          <span className="text-sm font-semibold text-ink">HouseMate</span>
        </div>

        {/* Loading state */}
        {state === 'loading' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                Verifying your{' '}
                <span className="font-serif italic text-accent">email</span>…
              </h1>
              <p className="text-sm text-ink-3">Just a moment, please hang tight.</p>
            </div>
            <div className="flex justify-center py-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
          </>
        )}

        {/* Success state */}
        {state === 'success' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                You're{' '}
                <span className="font-serif italic text-accent">verified</span>
              </h1>
              <p className="text-sm text-ink-3">
                Your email address has been confirmed. Welcome to HouseMate!
              </p>
            </div>

            <div className="flex justify-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pos/15">
                <CheckCircle2 className="h-7 w-7 text-pos" />
              </div>
            </div>

            <p className="text-center text-sm text-ink-3">
              You can now access all features of your household.
            </p>

            <Button asChild className="w-full shadow-accent-glow">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </>
        )}

        {/* Error state */}
        {state === 'error' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                Verification{' '}
                <span className="font-serif italic text-accent">failed</span>
              </h1>
              <p className="text-sm text-ink-3">
                We couldn't verify your email address.
              </p>
            </div>

            <div className="flex justify-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neg/15">
                <XCircle className="h-7 w-7 text-neg" />
              </div>
            </div>

            <p className="text-center text-sm text-ink-3">{errorMessage}</p>

            <Button asChild variant="outline" className="w-full">
              <Link to="/">Go to home</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
