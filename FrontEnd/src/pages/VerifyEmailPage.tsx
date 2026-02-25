import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import axios from 'axios';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <Mail className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Email Verification
            </CardTitle>
            <CardDescription className="text-base">
              {state === 'loading' && 'Verifying your email address...'}
              {state === 'success' && 'Your email has been verified'}
              {state === 'error' && 'Verification failed'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6 px-6 pb-8 sm:px-8">
          {state === 'loading' && (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-center text-sm text-muted-foreground">
                Your email address has been verified successfully. You can now access all features.
              </p>
              <Button asChild className="h-11 w-full rounded-xl text-base shadow-sm">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-sm text-muted-foreground">
                {errorMessage}
              </p>
              <Button asChild variant="outline" className="h-11 w-full rounded-xl text-base">
                <Link to="/">Go to Home</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
