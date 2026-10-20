import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/features/auth/AuthGuard';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { EvidencePage } from '@/features/evidence/EvidencePage';
import { AssessmentsPage } from '@/features/assessments/AssessmentsPage';
import { ReviewQueuePage } from '@/features/reviews/ReviewQueuePage';
import { CreditRegistryPage } from '@/features/credits/CreditRegistryPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { PublicVerificationPage } from '@/features/public/PublicVerificationPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public authentication route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Application shell & protected routes */}
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="evidence" element={<EvidencePage />} />
              <Route path="assessments" element={<AssessmentsPage />} />
              <Route
                path="reviews"
                element={
                  <RequireAuth roles={['REVIEWER', 'ADMIN']}>
                    <ReviewQueuePage />
                  </RequireAuth>
                }
              />
              <Route path="credits" element={<CreditRegistryPage />} />
              <Route
                path="audit"
                element={
                  <RequireAuth roles={['ADMIN']}>
                    <AuditPage />
                  </RequireAuth>
                }
              />
              <Route path="public" element={<PublicVerificationPage />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
