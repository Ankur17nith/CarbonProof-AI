import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateOnly,
  formatNumber,
  truncateHash,
  formatFileSize,
  getProjectStatusConfig,
  getSeverityConfig,
  getRiskLevelConfig,
  getBlockchainStatusConfig,
} from '@/lib/format';

describe('Format Utilities', () => {
  it('formats dates cleanly', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate(null)).toBe('—');
    const formatted = formatDate('2026-03-15T12:00:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Mar');

    const dateOnly = formatDateOnly('2026-03-15T12:00:00Z');
    expect(dateOnly).toContain('2026');
    expect(dateOnly).toContain('Mar');
  });

  it('formats large numbers with separators', () => {
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1250000)).toBe('1,250,000');
    expect(formatNumber('50000')).toBe('50,000');
    expect(formatNumber(BigInt(1000000))).toBe('1,000,000');
  });

  it('truncates hashes and addresses with ellipsis', () => {
    expect(truncateHash(undefined)).toBe('—');
    expect(truncateHash('')).toBe('—');
    expect(truncateHash('0x1234')).toBe('0x1234');
    const hash = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    expect(truncateHash(hash, 6, 4)).toBe('0x5FbD…0aa3');
  });

  it('formats file sizes accurately', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576 * 2.5)).toBe('2.5 MB');
  });

  it('computes correct risk score config', () => {
    expect(getRiskLevelConfig('LOW').label).toBe('Low Risk');
    expect(getRiskLevelConfig('MEDIUM').label).toBe('Moderate Risk');
    expect(getRiskLevelConfig('HIGH').label).toBe('High Risk');
  });

  it('computes project status configs correctly', () => {
    expect(getProjectStatusConfig('DRAFT').label).toBe('Draft');
    expect(getProjectStatusConfig('SUBMITTED').label).toBe('Submitted');
    expect(getProjectStatusConfig('UNDER_REVIEW').label).toBe('Under Review');
    expect(getProjectStatusConfig('VERIFIED_INTERNAL').label).toBe('Internal Verified');
    expect(getProjectStatusConfig('REJECTED').label).toBe('Rejected');
  });

  it('computes severity badge configurations', () => {
    expect(getSeverityConfig('CRITICAL').label).toBe('Critical');
    expect(getSeverityConfig('HIGH').label).toBe('High');
    expect(getSeverityConfig('MEDIUM').label).toBe('Medium');
    expect(getSeverityConfig('LOW').label).toBe('Low');
    expect(getSeverityConfig('INFO').label).toBe('Info');
  });

  it('computes blockchain status configurations', () => {
    expect(getBlockchainStatusConfig('confirmed').label).toBe('On-Chain Confirmed');
    expect(getBlockchainStatusConfig('pending').label).toBe('Pending Confirmation');
    expect(getBlockchainStatusConfig('failed').label).toBe('Settlement Failed');
    expect(getBlockchainStatusConfig('disabled').label).toBe('Blockchain Off');
    expect(getBlockchainStatusConfig(undefined).label).toBe('Not Settled');
  });
});
