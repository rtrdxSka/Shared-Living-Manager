import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/schemas/auth.schemas';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlobBack } from '@/components/ui/blob-back';
import type { ApiErrorResponse } from '@/types/auth.types';

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError('');

    try {
      await authApi.forgotPassword(data.email);
      setIsSubmitted(true);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'An error occurred. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

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

        {isSubmitted ? (
          /* Success state */
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                Check your <span className="font-serif italic text-accent">inbox</span>
              </h1>
              <p className="text-sm text-ink-3">
                If an account exists with that email, we sent a password reset link.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pos/15">
                <CheckCircle2 className="h-7 w-7 text-pos" />
              </div>
              <p className="text-center text-sm text-ink-3">
                Please check your inbox and spam folder. The link expires in 1 hour.
              </p>
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </>
        ) : (
          /* Form state */
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                Forgot <span className="font-serif italic text-accent">password</span>?
              </h1>
              <p className="text-sm text-ink-3">
                Enter your email and we'll send a reset link.
              </p>
            </div>

            {serverError && (
              <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-xs text-neg">
                {serverError}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                  Email
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
                    <Mail className="h-4 w-4" />
                  </span>
                  <Input
                    type="email"
                    placeholder="ivan@example.com"
                    autoComplete="email"
                    className="pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-neg mt-1">{errors.email.message}</p>
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
                    Sending…
                  </>
                ) : (
                  'Send reset link →'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-ink-3">
              Remember it?{' '}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
