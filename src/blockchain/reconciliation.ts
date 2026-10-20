import type { Logger } from 'pino';
import type { Hex } from 'viem';
import type { BlockchainRecord } from '../domain.js';
import type { Store } from '../repository.js';
import type { BlockchainAdapter, BlockchainTransactionReceipt } from './index.js';

export interface ReconciliationOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  logger?: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;
}

export interface DivergenceReport {
  recordId: string;
  recordType: string;
  entityId: string;
  dbStatus: string;
  onChainStatus: 'EXISTS' | 'NOT_FOUND' | 'UNCHECKED' | 'REVERTED';
  detail: string;
}

export interface ReconciliationResult {
  processed: number;
  confirmed: number;
  failed: number;
  divergences: DivergenceReport[];
  pending: number;
}

export class BlockchainReconciliationWorker {
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly logger?: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;
  private readonly retryState = new Map<string, { attempts: number; nextAttemptAt: number }>();
  private intervalTimer?: NodeJS.Timeout;

  public constructor(
    private readonly store: Store,
    private readonly blockchain: BlockchainAdapter,
    options: ReconciliationOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 5;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30000;
    this.logger = options.logger;
  }

  /**
   * Reconciles all pending and failed records in the store,
   * detecting divergence between on-chain state and database records.
   */
  public async reconcileAll(nowMs = Date.now()): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      processed: 0,
      confirmed: 0,
      failed: 0,
      divergences: [],
      pending: 0,
    };

    if (!this.blockchain.enabled) {
      this.logger?.debug?.('Reconciliation skipped: blockchain adapter is disabled.');
      return result;
    }

    const records = [...this.store.blockchainRecords.values()];

    for (const record of records) {
      if (record.status === 'CONFIRMED') {
        // Optional divergence check on confirmed records
        const divergence = await this.verifyConfirmedRecord(record);
        if (divergence) {
          result.divergences.push(divergence);
        }
        continue;
      }

      // Record is PENDING or FAILED
      result.processed++;
      const outcome = await this.reconcileRecord(record, nowMs);

      if (outcome.status === 'CONFIRMED') {
        result.confirmed++;
      } else if (outcome.status === 'FAILED') {
        result.failed++;
        if (outcome.divergence) {
          result.divergences.push(outcome.divergence);
        }
      } else {
        result.pending++;
      }
    }

    return result;
  }

  /**
   * Reconciles a single pending or unconfirmed blockchain record.
   * - Polls receipt if transactionHash exists.
   * - Queries contract state if transactionHash is missing (preventing blind resubmission).
   * - Applies exponential backoff and bounded retries.
   */
  public async reconcileRecord(
    record: BlockchainRecord,
    nowMs = Date.now(),
  ): Promise<{ status: BlockchainRecord['status']; divergence?: DivergenceReport }> {
    const state = this.retryState.get(record.id) ?? { attempts: 0, nextAttemptAt: 0 };

    if (nowMs < state.nextAttemptAt) {
      // Still in backoff window
      return { status: record.status };
    }

    state.attempts++;
    const backoff = Math.min(
      this.initialBackoffMs * Math.pow(2, state.attempts - 1),
      this.maxBackoffMs,
    );
    state.nextAttemptAt = nowMs + backoff;
    this.retryState.set(record.id, state);

    this.logger?.info?.(
      {
        recordId: record.id,
        recordType: record.recordType,
        entityId: record.entityId,
        attempt: state.attempts,
        hasTxHash: Boolean(record.transactionHash),
      },
      'Reconciling blockchain record',
    );

    try {
      // Case 1: Transaction was submitted and has a hash
      if (record.transactionHash) {
        return await this.reconcileSubmittedTransaction(record);
      }

      // Case 2: No transaction hash was recorded (e.g. crashed during submission)
      // Check on-chain state safely to see if the operation was executed anyway.
      return await this.reconcileMissingHash(record, state.attempts);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger?.warn?.(
        { recordId: record.id, error: errorMsg, attempt: state.attempts },
        'Reconciliation attempt failed',
      );

      if (state.attempts >= this.maxRetries) {
        record.status = 'FAILED';
        record.lastError = `Reconciliation exceeded max retries (${this.maxRetries}): ${errorMsg}`;
        record.updatedAt = new Date().toISOString();
        this.store.blockchainRecords.set(record.id, record);
        return {
          status: 'FAILED',
          divergence: {
            recordId: record.id,
            recordType: record.recordType,
            entityId: record.entityId,
            dbStatus: 'FAILED',
            onChainStatus: 'UNCHECKED',
            detail: record.lastError,
          },
        };
      }

      return { status: record.status };
    }
  }

  private async reconcileSubmittedTransaction(
    record: BlockchainRecord,
  ): Promise<{ status: BlockchainRecord['status']; divergence?: DivergenceReport }> {
    const confirmation = await this.blockchain.confirmTransaction(record.transactionHash as Hex, 1);

    if (confirmation.receipt.status === 'reverted') {
      record.status = 'FAILED';
      record.lastError = 'Transaction reverted on-chain';
      record.updatedAt = new Date().toISOString();
      this.store.blockchainRecords.set(record.id, record);

      this.logger?.error?.(
        { recordId: record.id, txHash: record.transactionHash },
        'Transaction reverted on-chain',
      );

      return {
        status: 'FAILED',
        divergence: {
          recordId: record.id,
          recordType: record.recordType,
          entityId: record.entityId,
          dbStatus: 'FAILED',
          onChainStatus: 'REVERTED',
          detail: 'Transaction was mined but reverted on-chain.',
        },
      };
    }

    // Mined successfully
    record.status = 'CONFIRMED';
    record.blockNumber = confirmation.blockNumber;
    record.confirmations = confirmation.confirmations;
    record.lastError = undefined;
    record.updatedAt = new Date().toISOString();
    this.store.blockchainRecords.set(record.id, record);

    // Reconcile associated credit event if applicable
    this.updateAssociatedEntity(record, confirmation.receipt);

    this.logger?.info?.(
      {
        recordId: record.id,
        txHash: record.transactionHash,
        blockNumber: confirmation.blockNumber.toString(),
      },
      'Blockchain record confirmed via reconciliation',
    );

    return { status: 'CONFIRMED' };
  }

  private async reconcileMissingHash(
    record: BlockchainRecord,
    attempts: number,
  ): Promise<{ status: BlockchainRecord['status']; divergence?: DivergenceReport }> {
    const recordIdentifier = record.recordIdentifier as Hex;

    if (record.recordType === 'EVIDENCE_REGISTRATION') {
      const exists = await this.blockchain.evidenceExists(recordIdentifier);
      if (exists.status === 'ok' && exists.value === true) {
        record.status = 'CONFIRMED';
        record.lastError = undefined;
        record.updatedAt = new Date().toISOString();
        this.store.blockchainRecords.set(record.id, record);
        return { status: 'CONFIRMED' };
      }
    } else if (
      record.recordType === 'CREDIT_ISSUANCE' ||
      record.recordType === 'CREDIT_RETIREMENT'
    ) {
      const used = await this.blockchain.operationUsed(recordIdentifier);
      if (used.status === 'ok' && used.value === true) {
        record.status = 'CONFIRMED';
        record.lastError = undefined;
        record.updatedAt = new Date().toISOString();
        this.store.blockchainRecords.set(record.id, record);
        return { status: 'CONFIRMED' };
      }
    }

    // If on-chain state does not show completion, and max retries reached, mark FAILED
    if (attempts >= this.maxRetries) {
      record.status = 'FAILED';
      record.lastError =
        'Transaction response lost and operation was not found on-chain. Manual reconciliation required.';
      record.updatedAt = new Date().toISOString();
      this.store.blockchainRecords.set(record.id, record);

      return {
        status: 'FAILED',
        divergence: {
          recordId: record.id,
          recordType: record.recordType,
          entityId: record.entityId,
          dbStatus: 'FAILED',
          onChainStatus: 'NOT_FOUND',
          detail: 'Database intent has no corresponding on-chain state.',
        },
      };
    }

    return { status: 'PENDING' };
  }

  private async verifyConfirmedRecord(
    record: BlockchainRecord,
  ): Promise<DivergenceReport | undefined> {
    const identifier = record.recordIdentifier as Hex;

    if (record.recordType === 'EVIDENCE_REGISTRATION') {
      const exists = await this.blockchain.evidenceExists(identifier);
      if (exists.status === 'ok' && exists.value === false) {
        return {
          recordId: record.id,
          recordType: record.recordType,
          entityId: record.entityId,
          dbStatus: 'CONFIRMED',
          onChainStatus: 'NOT_FOUND',
          detail:
            'Database marks evidence registration CONFIRMED, but on-chain evidenceExists is false.',
        };
      }
    } else if (
      record.recordType === 'CREDIT_ISSUANCE' ||
      record.recordType === 'CREDIT_RETIREMENT'
    ) {
      const used = await this.blockchain.operationUsed(identifier);
      if (used.status === 'ok' && used.value === false) {
        return {
          recordId: record.id,
          recordType: record.recordType,
          entityId: record.entityId,
          dbStatus: 'CONFIRMED',
          onChainStatus: 'NOT_FOUND',
          detail: 'Database marks credit operation CONFIRMED, but on-chain operationUsed is false.',
        };
      }
    }
    return undefined;
  }

  private updateAssociatedEntity(
    record: BlockchainRecord,
    receipt: BlockchainTransactionReceipt,
  ): void {
    if (record.recordType === 'CREDIT_ISSUANCE' || record.recordType === 'CREDIT_RETIREMENT') {
      const event = [...this.store.creditEvents.values()].find(
        (e) =>
          e.creditBatchId === record.entityId && e.idempotencyKey.includes(record.recordIdentifier),
      );
      if (event) {
        event.transactionHash = receipt.transactionHash;
        event.blockNumber = receipt.blockNumber;
        this.store.creditEvents.set(event.id, event);
      }
    }
  }

  public start(intervalMs = 10000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = globalThis.setInterval(() => {
      this.reconcileAll().catch((err) => {
        this.logger?.error?.({ err }, 'Background reconciliation loop error');
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      globalThis.clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }
}
