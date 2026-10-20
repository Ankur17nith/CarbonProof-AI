import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { createStore } from '../src/repository.js';
import type { BlockchainRecord } from '../src/domain.js';
import type { BlockchainAdapter, ConfirmedTransaction } from '../src/blockchain/index.js';
import { BlockchainReconciliationWorker } from '../src/blockchain/reconciliation.js';

describe('BlockchainReconciliationWorker', () => {
  function makeRecord(overrides: Partial<BlockchainRecord> = {}): BlockchainRecord {
    return {
      id: 'rec-1',
      recordType: 'CREDIT_ISSUANCE',
      entityId: 'batch-1',
      chainId: 31337,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      recordIdentifier: '0x' + 'aa'.repeat(32),
      payloadHash: 'hash-1',
      status: 'PENDING',
      confirmations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('reconciles a pending transaction with transactionHash when receipt confirms success', async () => {
    const store = createStore();
    const txHash = ('0x' + '12'.repeat(32)) as Hex;
    const record = makeRecord({ transactionHash: txHash, status: 'PENDING' });
    store.blockchainRecords.set(record.id, record);

    const mockConfirm = vi.fn().mockResolvedValue({
      status: 'confirmed',
      hash: txHash,
      chainId: 31337,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      confirmations: 1,
      blockNumber: 42n,
      receipt: { status: 'success', transactionHash: txHash, blockNumber: 42n },
    } as ConfirmedTransaction);

    const mockAdapter = {
      enabled: true,
      confirmTransaction: mockConfirm,
      evidenceExists: vi.fn(),
      operationUsed: vi.fn(),
    } as unknown as BlockchainAdapter;

    const worker = new BlockchainReconciliationWorker(store, mockAdapter, {
      maxRetries: 3,
      initialBackoffMs: 10,
    });

    const result = await worker.reconcileAll();
    expect(result.processed).toBe(1);
    expect(result.confirmed).toBe(1);
    expect(result.failed).toBe(0);

    const updated = store.blockchainRecords.get(record.id);
    expect(updated?.status).toBe('CONFIRMED');
    expect(updated?.blockNumber).toBe(42n);
    expect(updated?.confirmations).toBe(1);
  });

  it('detects and marks failure when transaction reverted on-chain', async () => {
    const store = createStore();
    const txHash = ('0x' + '34'.repeat(32)) as Hex;
    const record = makeRecord({ transactionHash: txHash, status: 'PENDING' });
    store.blockchainRecords.set(record.id, record);

    const mockConfirm = vi.fn().mockResolvedValue({
      status: 'confirmed',
      hash: txHash,
      chainId: 31337,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      confirmations: 1,
      blockNumber: 43n,
      receipt: { status: 'reverted', transactionHash: txHash, blockNumber: 43n },
    } as ConfirmedTransaction);

    const mockAdapter = {
      enabled: true,
      confirmTransaction: mockConfirm,
    } as unknown as BlockchainAdapter;

    const worker = new BlockchainReconciliationWorker(store, mockAdapter, {
      maxRetries: 3,
      initialBackoffMs: 10,
    });

    const result = await worker.reconcileAll();
    expect(result.failed).toBe(1);
    expect(result.divergences.length).toBe(1);
    expect(result.divergences[0]?.onChainStatus).toBe('REVERTED');

    const updated = store.blockchainRecords.get(record.id);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.lastError).toContain('reverted');
  });

  it('recovers without resubmission when transactionHash was lost but on-chain state exists', async () => {
    const store = createStore();
    const recordIdentifier = ('0x' + 'ee'.repeat(32)) as Hex;
    const record = makeRecord({
      recordType: 'EVIDENCE_REGISTRATION',
      recordIdentifier,
      transactionHash: undefined,
      status: 'PENDING',
    });
    store.blockchainRecords.set(record.id, record);

    const mockAdapter = {
      enabled: true,
      evidenceExists: vi.fn().mockResolvedValue({ status: 'ok', value: true }),
      operationUsed: vi.fn(),
    } as unknown as BlockchainAdapter;

    const worker = new BlockchainReconciliationWorker(store, mockAdapter, {
      maxRetries: 3,
      initialBackoffMs: 10,
    });

    const result = await worker.reconcileAll();
    expect(result.confirmed).toBe(1);
    expect(mockAdapter.evidenceExists).toHaveBeenCalledWith(recordIdentifier);

    const updated = store.blockchainRecords.get(record.id);
    expect(updated?.status).toBe('CONFIRMED');
  });

  it('marks FAILED after bounded retries and backoff when unconfirmed and not on-chain', async () => {
    const store = createStore();
    const recordIdentifier = ('0x' + 'ff'.repeat(32)) as Hex;
    const record = makeRecord({
      recordType: 'CREDIT_ISSUANCE',
      recordIdentifier,
      transactionHash: undefined,
      status: 'PENDING',
    });
    store.blockchainRecords.set(record.id, record);

    const mockAdapter = {
      enabled: true,
      operationUsed: vi.fn().mockResolvedValue({ status: 'ok', value: false }),
    } as unknown as BlockchainAdapter;

    const worker = new BlockchainReconciliationWorker(store, mockAdapter, {
      maxRetries: 2,
      initialBackoffMs: 1,
      maxBackoffMs: 5,
    });

    // Attempt 1: remains pending
    const res1 = await worker.reconcileAll(100);
    expect(res1.pending).toBe(1);
    expect(store.blockchainRecords.get(record.id)?.status).toBe('PENDING');

    // Attempt 2 (after backoff): reaches maxRetries -> FAILED
    const res2 = await worker.reconcileAll(200);
    expect(res2.failed).toBe(1);
    expect(res2.divergences.length).toBe(1);
    expect(store.blockchainRecords.get(record.id)?.status).toBe('FAILED');
  });

  it('detects divergence when DB record says CONFIRMED but contract query says false', async () => {
    const store = createStore();
    const recordIdentifier = ('0x' + 'aa'.repeat(32)) as Hex;
    const record = makeRecord({
      recordType: 'EVIDENCE_REGISTRATION',
      recordIdentifier,
      status: 'CONFIRMED',
    });
    store.blockchainRecords.set(record.id, record);

    const mockAdapter = {
      enabled: true,
      evidenceExists: vi.fn().mockResolvedValue({ status: 'ok', value: false }),
    } as unknown as BlockchainAdapter;

    const worker = new BlockchainReconciliationWorker(store, mockAdapter);
    const result = await worker.reconcileAll();

    expect(result.divergences.length).toBe(1);
    expect(result.divergences[0]?.detail).toContain(
      'Database marks evidence registration CONFIRMED, but on-chain evidenceExists is false',
    );
  });
});
