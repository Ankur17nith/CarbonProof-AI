import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Info } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'contributor@example.test',
      password: 'development-only-password-123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Authentication failed. Please verify credentials.');
      }
    }
  };

  const handleSelectDemoUser = (email: string) => {
    setValue('email', email);
    setValue('password', 'development-only-password-123');
    setServerError(null);
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent-border mb-3">
            <img src="/logo.svg" alt="" className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-fg">Sign in to CarbonProof AI</h1>
          <p className="text-xs text-fg-secondary max-w-sm mx-auto">
            Environmental verification and explainable risk-scoring workspace.
          </p>
        </div>

        <Card className="border-border/90 shadow-elevated">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-base">Workspace Access</CardTitle>
              <CardDescription>
                Authenticate with an authorized role account.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {serverError && (
                <div
                  className="rounded-md bg-status-error-bg p-3 text-xs font-medium text-status-error-text border border-status-error-border"
                  role="alert"
                >
                  {serverError}
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="user@example.test"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                error={errors.password?.message}
                {...register('password')}
              />

              {/* Demo role quick-selectors */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-xs text-fg-muted mb-2">
                  <Info className="h-3.5 w-3.5 text-accent" />
                  <span>Quick demo accounts:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectDemoUser('contributor@example.test')}
                    className="rounded border border-border bg-surface-secondary/70 p-2 text-left hover:bg-surface-hover hover:border-accent/40 focus-ring transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-fg">Contributor</div>
                    <div className="text-[9px] text-fg-muted truncate">Project author</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectDemoUser('reviewer@example.test')}
                    className="rounded border border-border bg-surface-secondary/70 p-2 text-left hover:bg-surface-hover hover:border-accent/40 focus-ring transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-fg">Reviewer</div>
                    <div className="text-[9px] text-fg-muted truncate">Audits & queue</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectDemoUser('admin@example.test')}
                    className="rounded border border-border bg-surface-secondary/70 p-2 text-left hover:bg-surface-hover hover:border-accent/40 focus-ring transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-fg">Administrator</div>
                    <div className="text-[9px] text-fg-muted truncate">Full settlement</div>
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-3">
              <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
                Sign In
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center">
          <p className="text-[11px] text-fg-muted">
            All verification rules and scoring are deterministic. Passwords are salted with bcrypt.
          </p>
        </div>
      </div>
    </div>
  );
}
