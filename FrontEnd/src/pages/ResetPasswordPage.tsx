import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';

import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/schemas/auth.schemas';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlobBack } from '@/components/ui/blob-back';
import type { ApiErrorResponse } from '@/types/auth.types';

function PageShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Remove token from URL so it doesn't linger in browser history
  useEffect(() => {
    if (token) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    setServerError('');

    try {
      await authApi.resetPassword(token, data.password);
      setIsSuccess(true);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'Password reset failed. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // No token in URL
  if (!token) {
    return (
      <PageShell>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">
            Invalid <span className="font-serif italic text-accent">link</span>
          </h1>
          <p className="text-sm text-ink-3">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="flex justify-center py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neg/15">
            <XCircle className="h-7 w-7 text-neg" />
          </div>
        </div>

        <Button asChild className="w-full shadow-accent-glow">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </PageShell>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <PageShell>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">
            Password <span className="font-serif italic text-accent">reset</span>
          </h1>
          <p className="text-sm text-ink-3">
            Your password has been reset successfully.
          </p>
        </div>

        <div className="flex justify-center py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pos/15">
            <CheckCircle2 className="h-7 w-7 text-pos" />
          </div>
        </div>

        <Button asChild className="w-full shadow-accent-glow">
          <Link to="/login">Sign in with new password</Link>
        </Button>
      </PageShell>
    );
  }

  // Form state
  return (
    <PageShell>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-ink">
          Set a <span className="font-serif italic text-accent">new password</span>
        </h1>
        <p className="text-sm text-ink-3">Make it something you'll remember.</p>
      </div>

      {serverError && (
        <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-xs text-neg">
          {serverError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New password */}
        <div>
          <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
            New password
          </Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <Lock className="h-4 w-4" />
            </span>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pl-10 pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-neg mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
            Confirm password
          </Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <Lock className="h-4 w-4" />
            </span>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="pl-10"
              {...register('confirmPassword')}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-neg mt-1">{errors.confirmPassword.message}</p>
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
              Resetting…
            </>
          ) : (
            'Reset password →'
          )}
        </Button>
      </form>
    </PageShell>
  );
}
