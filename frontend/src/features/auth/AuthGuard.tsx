import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/types/api';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RequireAuthProps {
  children: React.ReactNode;
  roles?: Role[];
}

export function RequireAuth({ children, roles = [] }: RequireAuthProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && user && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md text-center border-status-warning-border bg-status-warning-bg/30">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-text mb-2">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle>Permission Required</CardTitle>
            <CardDescription>
              Your account ({user.email}) has the <span className="font-mono font-semibold">{user.role}</span> role, which is not authorized to access this section.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Platform Overview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
