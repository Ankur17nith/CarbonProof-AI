import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '@/features/auth/LoginPage';
import { PublicVerificationPage } from '@/features/public/PublicVerificationPage';
import { AuthProvider } from '@/lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Feature Pages & Workflows', () => {
  it('renders Login Page with demo quick-select role buttons', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in to carbonproof/i })).toBeInTheDocument();
    expect(screen.getByText(/quick demo accounts/i)).toBeInTheDocument();

    const reviewerChip = screen.getByRole('button', { name: /reviewer/i });
    expect(reviewerChip).toBeInTheDocument();

    // Clicking demo chip fills the email and password inputs
    await user.click(reviewerChip);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveValue('reviewer@example.test');
  });

  it('renders Public Verification Page and handles search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicVerificationPage />);

    expect(screen.getByRole('heading', { name: /public verification portal/i })).toBeInTheDocument();
    expect(
      screen.getByText(/zero-trust public lookup for project disclosures/i)
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/enter project uuid/i);
    await user.type(input, 'seed-project-001');
    expect(input).toHaveValue('seed-project-001');

    const searchBtn = screen.getByRole('button', { name: /verify record/i });
    expect(searchBtn).toBeInTheDocument();
  });
});
