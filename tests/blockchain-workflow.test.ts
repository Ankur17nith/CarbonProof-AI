import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { createApp } from '../src/app.js';
import type { BlockchainAdapter } from '../src/blockchain/index.js';

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001' as const;
const TRANSACTION_HASH = `0x${'ab'.repeat(32)}` as Hex;

async function login(app: Parameters<typeof request>[0], email: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'development-only-password-123' });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

function failingConfirmationAdapter(): BlockchainAdapter {
  const submitted = {
    status: 'submitted' as const,
    hash: TRANSACTION_HASH,
    chainId: 31337,
    contractAddress: CONTRACT_ADDRESS,
    functionName: 'issueCredits' as const,
  };
  return {
    enabled: true,
    chainId: 31337,
    contractAddress: CONTRACT_ADDRESS,
    registerEvidence: vi.fn().mockResolvedValue({ ...submitted, functionName: 'registerEvidence' }),
    issueCredits: vi.fn().mockResolvedValue(submitted),
    retireCredits: vi.fn().mockResolvedValue({ ...submitted, functionName: 'retireCredits' }),
    confirmTransaction: vi.fn().mockRejectedValue(new Error('receipt unavailable')),
  } as unknown as BlockchainAdapter;
}

describe('API blockchain workflow integration', () => {
  it('keeps evidence and credit endpoints working with explicit disabled metadata', async () => {
    const context = await createApp({
      NODE_ENV: 'test',
      BLOCKCHAIN_ENABLED: false,
      FILE_STORAGE_ROOT: `/tmp/carbonproof-blockchain-disabled-${randomUUID()}`,
    });
    const contributor = await login(context.app, 'contributor@example.test');
    const admin = await login(context.app, 'admin@example.test');

    const projectResponse = await request(context.app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        name: 'Disabled Blockchain Project',
        slug: `disabled-blockchain-${randomUUID()}`,
        projectType: 'REFORESTATION',
        methodology: 'Demo',
      });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.data.id as string;

    const evidenceResponse = await request(context.app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        evidenceType: 'report',
        title: 'Disabled mode evidence',
        mediaType: 'application/json',
        structuredData: { quantity: 10 },
      });
    expect(evidenceResponse.status).toBe(201);
    expect(evidenceResponse.body.data.blockchain).toEqual({
      enabled: false,
      status: 'disabled',
    });
    expect(context.store.blockchainRecords.size).toBe(0);

    const batchResponse = await request(context.app)
      .post('/api/v1/credits/batches')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        projectId,
        batchReference: 'DISABLED-001',
        unit: 'tCO2e',
        totalQuantity: '20',
      });
    expect(batchResponse.status).toBe(201);
    const batchId = batchResponse.body.data.id as string;

    const issueResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'disabled-issue-1')
      .send({ quantity: '7' });
    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.data.batch.issuedQuantity).toBe('7');
    expect(issueResponse.body.data.event.metadata).toEqual({ blockchain: 'disabled' });

    const publicResponse = await request(context.app).get(`/api/v1/public/credits/${batchId}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.blockchain).toMatchObject({
      enabled: false,
      status: 'disabled',
    });
  });

  it('persists pending intent before submission and records truthful confirmation failure', async () => {
    const adapter = failingConfirmationAdapter();
    let context: Awaited<ReturnType<typeof createApp>>;
    const pendingStatuses: string[] = [];
    vi.mocked(adapter.registerEvidence).mockImplementation(async () => {
      const record = [...context.store.blockchainRecords.values()][0];
      pendingStatuses.push(record?.status ?? 'missing');
      return {
        status: 'submitted',
        hash: TRANSACTION_HASH,
        chainId: 31337,
        contractAddress: CONTRACT_ADDRESS,
        functionName: 'registerEvidence',
      };
    });
    vi.mocked(adapter.issueCredits).mockImplementation(async () => {
      const record = [...context.store.blockchainRecords.values()].find(
        (item) => item.recordType === 'CREDIT_ISSUANCE',
      );
      pendingStatuses.push(record?.status ?? 'missing');
      return {
        status: 'submitted',
        hash: TRANSACTION_HASH,
        chainId: 31337,
        contractAddress: CONTRACT_ADDRESS,
        functionName: 'issueCredits',
      };
    });
    vi.mocked(adapter.retireCredits).mockImplementation(async () => {
      const record = [...context.store.blockchainRecords.values()].find(
        (item) => item.recordType === 'CREDIT_RETIREMENT',
      );
      pendingStatuses.push(record?.status ?? 'missing');
      return {
        status: 'submitted',
        hash: TRANSACTION_HASH,
        chainId: 31337,
        contractAddress: CONTRACT_ADDRESS,
        functionName: 'retireCredits',
      };
    });
    context = await createApp(
      {
        NODE_ENV: 'test',
        BLOCKCHAIN_ENABLED: true,
        BLOCKCHAIN_CONTRACT_ADDRESS: CONTRACT_ADDRESS,
        FILE_STORAGE_ROOT: `/tmp/carbonproof-blockchain-failure-${randomUUID()}`,
      },
      undefined,
      adapter,
    );
    const contributor = await login(context.app, 'contributor@example.test');
    const admin = await login(context.app, 'admin@example.test');

    const projectResponse = await request(context.app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        name: 'Enabled Blockchain Project',
        slug: `enabled-blockchain-${randomUUID()}`,
        projectType: 'REFORESTATION',
        methodology: 'Demo',
      });
    const projectId = projectResponse.body.data.id as string;

    const evidenceResponse = await request(context.app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        evidenceType: 'report',
        title: 'Enabled mode evidence',
        mediaType: 'application/json',
        structuredData: { quantity: 10 },
      });
    expect(evidenceResponse.status).toBe(201);
    expect(evidenceResponse.body.data.blockchain).toMatchObject({
      enabled: true,
      status: 'failed',
      transactionHash: TRANSACTION_HASH,
      error: 'receipt unavailable',
    });
    const evidenceRecord = [...context.store.blockchainRecords.values()].find(
      (item) => item.recordType === 'EVIDENCE_REGISTRATION',
    );
    expect(evidenceRecord).toMatchObject({
      status: 'FAILED',
      transactionHash: TRANSACTION_HASH,
      lastError: 'receipt unavailable',
    });

    const batchResponse = await request(context.app)
      .post('/api/v1/credits/batches')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        projectId,
        batchReference: 'ENABLED-001',
        unit: 'tCO2e',
        totalQuantity: '20',
      });
    const batchId = batchResponse.body.data.id as string;

    const issueResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'enabled-issue-1')
      .send({ quantity: '7' });
    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.data.batch.issuedQuantity).toBe('7');
    expect(issueResponse.body.data.event.metadata).toMatchObject({
      enabled: true,
      status: 'failed',
      transactionHash: TRANSACTION_HASH,
      error: 'receipt unavailable',
    });
    expect(issueResponse.body.data.event.transactionHash).toBe(TRANSACTION_HASH);
    expect(pendingStatuses).toEqual(['PENDING', 'PENDING']);

    const creditRecord = [...context.store.blockchainRecords.values()].find(
      (item) => item.recordType === 'CREDIT_ISSUANCE',
    );
    expect(creditRecord).toMatchObject({
      status: 'FAILED',
      transactionHash: TRANSACTION_HASH,
      lastError: 'receipt unavailable',
    });
    const issueCall = vi.mocked(adapter.issueCredits).mock.calls[0]?.[0];
    expect(issueCall?.operationId).toBe(creditRecord?.recordIdentifier);

    const replayResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'enabled-issue-1')
      .send({ quantity: '7' });
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data.replayed).toBe(true);
    expect(adapter.issueCredits).toHaveBeenCalledTimes(1);
    expect(context.store.creditBatches.get(batchId)?.issuedQuantity).toBe(7n);

    const retireResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/retire`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'enabled-retire-1')
      .send({ quantity: '2' });
    expect(retireResponse.status).toBe(201);
    expect(retireResponse.body.data.batch.retiredQuantity).toBe('2');
    expect(retireResponse.body.data.event.metadata).toMatchObject({
      enabled: true,
      status: 'failed',
      transactionHash: TRANSACTION_HASH,
      error: 'receipt unavailable',
    });
    expect(pendingStatuses).toEqual(['PENDING', 'PENDING', 'PENDING']);
    expect(context.store.creditBatches.get(batchId)).toMatchObject({
      issuedQuantity: 7n,
      retiredQuantity: 2n,
    });
    expect(adapter.retireCredits).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2n }));
  });
});
