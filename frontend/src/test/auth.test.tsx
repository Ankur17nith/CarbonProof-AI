import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  setApiAuthToken: vi.fn(),
  setOnUnauthorized: vi.fn(),
}));

function TestConsumer() {
  const { user, role, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Anonymous'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="user-role">{role}</div>
      <button onClick={() => void login('auditor@carbonproof.ai', 'AuditorPass123!')}>
        Login Auditor
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('Auth Context', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes as anonymous when sessionStorage is empty', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Anonymous');
    expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    expect(screen.getByTestId('user-role')).toHaveTextContent('PUBLIC');
  });

  it('updates state and persists to sessionStorage on login', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u-1',
      email: 'auditor@carbonproof.ai',
      role: 'AUDITOR' as const,
      organization: 'ClimateCert',
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      accessToken: 'jwt-access-token-123',
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /login auditor/i }));

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('auditor@carbonproof.ai');
    expect(screen.getByTestId('user-role')).toHaveTextContent('AUDITOR');
    expect(sessionStorage.getItem('carbonproof_auth_token')).toBe('jwt-access-token-123');
  });

  it('clears state and removes sessionStorage items on logout', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('carbonproof_auth_token', 'saved-token');
    sessionStorage.setItem(
      'carbonproof_auth_user',
      JSON.stringify({
        id: 'u-2',
        email: 'dev@carbonproof.ai',
        role: 'PROJECT_DEVELOPER',
        organization: 'EcoOrg',
      })
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Anonymous');
    expect(sessionStorage.getItem('carbonproof_auth_token')).toBeNull();
  });
});
