import type { FindingSeverity, ProjectStatus, RiskLevel, BlockchainWorkflowStatus } from '@/types/api';

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatNumber(value: number | string | bigint | undefined | null): string {
  if (value === undefined || value === null) return '0';
  try {
    const num = typeof value === 'bigint' ? Number(value) : Number(value);
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-US').format(num);
  } catch {
    return String(value);
  }
}

export function truncateHash(hash?: string | null, leading = 6, trailing = 4): string {
  if (!hash) return '—';
  if (hash.length <= leading + trailing) return hash;
  return `${hash.slice(0, leading)}…${hash.slice(-trailing)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface StatusBadgeConfig {
  label: string;
  className: string;
}

export function getProjectStatusConfig(status: ProjectStatus): StatusBadgeConfig {
  switch (status) {
    case 'VERIFIED_INTERNAL':
      return {
        label: 'Internal Verified',
        className: 'bg-status-success-bg text-status-success-text border-status-success-border',
      };
    case 'UNDER_REVIEW':
      return {
        label: 'Under Review',
        className: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
      };
    case 'SUBMITTED':
      return {
        label: 'Submitted',
        className: 'bg-status-info-bg text-status-info-text border-status-info-border',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        className: 'bg-status-error-bg text-status-error-text border-status-error-border',
      };
    case 'DRAFT':
    default:
      return {
        label: 'Draft',
        className: 'bg-surface-secondary text-fg-secondary border-border',
      };
  }
}

export function getSeverityConfig(severity: FindingSeverity): StatusBadgeConfig {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'Critical',
        className: 'bg-status-error-bg text-status-error-text border-status-error-border font-medium',
      };
    case 'HIGH':
      return {
        label: 'High',
        className: 'bg-status-error-bg text-status-error-text border-status-error-border',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        className: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
      };
    case 'LOW':
      return {
        label: 'Low',
        className: 'bg-status-info-bg text-status-info-text border-status-info-border',
      };
    case 'INFO':
    default:
      return {
        label: 'Info',
        className: 'bg-surface-secondary text-fg-secondary border-border',
      };
  }
}

export function getRiskLevelConfig(level: RiskLevel): StatusBadgeConfig {
  switch (level) {
    case 'HIGH':
      return {
        label: 'High Risk',
        className: 'bg-status-error-bg text-status-error-text border-status-error-border',
      };
    case 'MEDIUM':
      return {
        label: 'Moderate Risk',
        className: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
      };
    case 'LOW':
    default:
      return {
        label: 'Low Risk',
        className: 'bg-status-success-bg text-status-success-text border-status-success-border',
      };
  }
}

export function getBlockchainStatusConfig(status?: BlockchainWorkflowStatus): StatusBadgeConfig {
  switch (status) {
    case 'confirmed':
      return {
        label: 'On-Chain Confirmed',
        className: 'bg-status-success-bg text-status-success-text border-status-success-border',
      };
    case 'pending':
      return {
        label: 'Pending Confirmation',
        className: 'bg-status-warning-bg text-status-warning-text border-status-warning-border animate-pulse',
      };
    case 'failed':
      return {
        label: 'Settlement Failed',
        className: 'bg-status-error-bg text-status-error-text border-status-error-border',
      };
    case 'disabled':
      return {
        label: 'Blockchain Off',
        className: 'bg-surface-secondary text-fg-muted border-border',
      };
    default:
      return {
        label: 'Not Settled',
        className: 'bg-surface-secondary text-fg-secondary border-border',
      };
  }
}
