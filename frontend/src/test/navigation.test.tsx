import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuthContext } from '@/lib/auth';
import type { User } from '@/types/api';

const mockReviewer: User = {
  id: 'u-1',
  email: 'reviewer@carbonproof.ai',
  displayName: 'Senior Reviewer',
  role: 'REVIEWER',
};

const mockContributor: User = {
  id: 'u-2',
  email: 'contributor@carbonproof.ai',
  displayName: 'Project Contributor',
  role: 'CONTRIBUTOR',
};

describe('Navigation and Layout', () => {
  it('renders Sidebar with links and includes Review Queue for REVIEWER', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider
          value={{
            user: mockReviewer,
            role: 'REVIEWER',
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <Sidebar isOpen={true} onClose={() => {}} isDark={false} onToggleTheme={() => {}} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText('CarbonProof AI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /assessments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review queue/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /credit registry/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /public verification/i })).toBeInTheDocument();
    // Audit Trail is admin only
    expect(screen.queryByRole('link', { name: /audit trail/i })).not.toBeInTheDocument();
  });

  it('hides Review Queue and Audit Trail for CONTRIBUTOR', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider
          value={{
            user: mockContributor,
            role: 'CONTRIBUTOR',
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <Sidebar isOpen={true} onClose={() => {}} isDark={false} onToggleTheme={() => {}} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /projects/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit trail/i })).not.toBeInTheDocument();
  });

  it('renders Header with breadcrumb, environment indicator, and user role badge', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AuthContext.Provider
          value={{
            user: mockReviewer,
            role: 'REVIEWER',
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <Header onOpenSidebar={() => {}} title="Project Explorer" breadcrumb="Projects" />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Project Explorer')).toBeInTheDocument();
    expect(screen.getByText('Local Verification Engine')).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
  });
});
