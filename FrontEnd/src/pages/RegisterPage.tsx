import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

import {
  registerSchema,
  type RegisterFormData,
} from '@/schemas/auth.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlobBack } from '@/components/ui/blob-back';

import type { ApiErrorResponse } from '@/types/auth.types';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError('');

    try {
      // confirmPassword is frontend-only, don't send it
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(
          apiError?.message ||
            'An error occurred during registration. Please try again.'
        );
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

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">
            Make your <span className="font-serif italic text-accent">household</span>
          </h1>
          <p className="text-sm text-ink-3">2 minutes. No credit card.</p>
        </div>

        {/* Server error */}
        {serverError && (
          <p className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-xs text-neg">
            {serverError}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* First name + Last name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                First name
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  type="text"
                  placeholder="Ivan"
                  autoComplete="given-name"
                  className="pl-10"
                  {...register('firstName')}
                />
              </div>
              {errors.firstName && (
                <p className="text-xs text-neg mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                Last name
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  type="text"
                  placeholder="Smith"
                  autoComplete="family-name"
                  className="pl-10"
                  {...register('lastName')}
                />
              </div>
              {errors.lastName && (
                <p className="text-xs text-neg mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
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

          {/* Password */}
          <div>
            <Label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              Password
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
                Creating account…
              </>
            ) : (
              'Create account →'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Google stub */}
        <Button variant="outline" disabled className="w-full">
          <span className="text-ink-3">Continue with Google</span>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.14em] text-ink-4">
            Coming soon
          </span>
        </Button>

        {/* Footer */}
        <p className="text-center text-sm text-ink-3">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
