import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';

describe('UI Primitives', () => {
  it('renders Button with variants and handles clicks', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} variant="primary">Submit</Button>);
    
    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders Button in loading state', () => {
    render(<Button isLoading>Processing</Button>);
    const button = screen.getByRole('button', { name: /processing/i });
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders Badge with custom variants', () => {
    render(<Badge variant="success">Verified</Badge>);
    const badge = screen.getByText('Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-status-success-text');
  });

  it('renders Card with header and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Project Integrity</CardTitle>
        </CardHeader>
        <CardContent>All evidence hashes validated.</CardContent>
      </Card>
    );
    expect(screen.getByText('Project Integrity')).toBeInTheDocument();
    expect(screen.getByText('All evidence hashes validated.')).toBeInTheDocument();
  });

  it('renders Input with label, error and hint', () => {
    render(
      <Input
        label="Project Name"
        placeholder="e.g. Kasigau Corridor"
        error="Name is required"
        hint="Enter official registry name"
      />
    );
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Kasigau Corridor')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders Select with options', async () => {
    const user = userEvent.setup();
    render(
      <Select label="Project Category">
        <option value="AFFORESTATION">Afforestation</option>
        <option value="RENEWABLE_ENERGY">Renewable Energy</option>
      </Select>
    );
    const select = screen.getByLabelText(/project category/i);
    expect(select).toBeInTheDocument();
    await user.selectOptions(select, 'RENEWABLE_ENERGY');
    expect(select).toHaveValue('RENEWABLE_ENERGY');
  });

  it('renders Modal when isOpen is true and calls onClose on dismiss', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Review Decision">
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Review Decision')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
