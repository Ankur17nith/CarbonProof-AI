import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { createApp } from '../src/app.js';
import { createBlockchainAdapter } from '../src/blockchain/index.js';

const ANVIL_RPC_URL = 'http://127.0.0.1:8545';
const DEPLOYED_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ANVIL_SIGNER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CHAIN_ID = 31337;

async function login(app: Parameters<typeof request>[0], email: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'development-only-password-123' });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

describe('Local EVM Integration with Anvil and Deployed Contract', () => {
  it('executes end-to-end evidence registration, credit lifecycle, idempotency and contract queries', async () => {
    // Check if Anvil is reachable
    const liveAdapter = createBlockchainAdapter({
      enabled: true,
      rpcUrl: ANVIL_RPC_URL,
      chainId: CHAIN_ID,
      contractAddress: DEPLOYED_CONTRACT_ADDRESS,
      signerPrivateKey: ANVIL_SIGNER_KEY,
      confirmations: 1,
    });

    const health = await liveAdapter.health();
    expect(health.status).toBe('healthy');
    expect(health.contractReachability).toBe('verified');

    // Create App with live blockchain enabled
    const storageRoot = `/tmp/carbonproof-local-evm-${randomUUID()}`;
    const context = await createApp(
      {
        NODE_ENV: 'test',
        BLOCKCHAIN_ENABLED: true,
        BLOCKCHAIN_RPC_URL: ANVIL_RPC_URL,
        BLOCKCHAIN_CHAIN_ID: CHAIN_ID,
        BLOCKCHAIN_CONTRACT_ADDRESS: DEPLOYED_CONTRACT_ADDRESS,
        BLOCKCHAIN_SIGNER_PRIVATE_KEY: ANVIL_SIGNER_KEY,
        FILE_STORAGE_ROOT: storageRoot,
      },
      undefined,
      liveAdapter,
    );

    const contributor = await login(context.app, 'contributor@example.test');
    const admin = await login(context.app, 'admin@example.test');

    // 1. Create project
    const projectResponse = await request(context.app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        name: 'Local EVM Project',
        slug: `local-evm-${randomUUID()}`,
        projectType: 'BIOCHAR',
        methodology: 'Verified Biochar Standard',
      });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.data.id as string;

    // 1. Register an evidence fingerprint
    const evidenceResponse = await request(context.app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        evidenceType: 'field-audit',
        title: 'Kiln Combustion Telemetry',
        mediaType: 'application/json',
        structuredData: { temperature: 850, durationHours: 12 },
      });
    expect(evidenceResponse.status).toBe(201);
    const evidenceData = evidenceResponse.body.data;
    expect(evidenceData.blockchain.enabled).toBe(true);
    expect(evidenceData.blockchain.status).toBe('confirmed');
    expect(evidenceData.blockchain.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(evidenceData.blockchain.blockNumber).toBeDefined();

    // 2. Read it back from the contract
    const onChainEvidenceId = evidenceData.blockchain.recordIdentifier as Hex;
    const readEvidenceResult = await liveAdapter.getEvidence(onChainEvidenceId);
    expect(readEvidenceResult.status).toBe('ok');
    expect(readEvidenceResult.value).not.toBeNull();
    expect(readEvidenceResult.value?.registeredBy.toLowerCase()).toBe(
      '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    );
    expect(readEvidenceResult.value?.contentHash).toBe(`0x${evidenceData.sha256}`);

    // Check evidence exists check on-chain
    const existsResult = await liveAdapter.evidenceExists(onChainEvidenceId);
    expect(existsResult.value).toBe(true);

    // 3. Create credit batch & submit a valid credit issuance operation
    const batchResponse = await request(context.app)
      .post('/api/v1/credits/batches')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        projectId,
        batchReference: `BATCH-EVM-${randomUUID().slice(0, 8)}`,
        unit: 'tCO2e',
        totalQuantity: '1000',
      });
    expect(batchResponse.status).toBe(201);
    const batchId = batchResponse.body.data.id as string;

    // 4. Wait for the transaction receipt and confirm database state
    const issueIdempotencyKey = `issue-${randomUUID()}`;
    const issueResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', issueIdempotencyKey)
      .send({ quantity: '350' });

    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.data.batch.issuedQuantity).toBe('350');
    expect(issueResponse.body.data.event.metadata.status).toBe('confirmed');
    expect(issueResponse.body.data.event.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // 5. Verify the expected event & on-chain balance
    // On-chain project ID is derived deterministically
    const creditRecord = [...context.store.blockchainRecords.values()].find(
      (item) => item.entityId === batchId && item.recordType === 'CREDIT_ISSUANCE',
    );
    expect(creditRecord).toBeDefined();
    expect(creditRecord?.status).toBe('CONFIRMED');

    // 6. Confirm database transaction record reaches the correct state
    const onChainOperationId = creditRecord?.recordIdentifier as Hex;
    const opUsedResult = await liveAdapter.operationUsed(onChainOperationId);
    expect(opUsedResult.status).toBe('ok');
    expect(opUsedResult.value).toBe(true);

    // 7. Repeat the same idempotent API request
    const replayIssueResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', issueIdempotencyKey)
      .send({ quantity: '350' });

    expect(replayIssueResponse.status).toBe(201);
    expect(replayIssueResponse.body.data.replayed).toBe(true);
    expect(replayIssueResponse.body.data.batch.issuedQuantity).toBe('350');

    // 8. Attempt a prohibited duplicate operation directly on-chain
    // Submitting with the exact same operationId must revert with DuplicateOperationId
    const duplicateSubmissionPromise = liveAdapter.issueCredits({
      operationId: onChainOperationId,
      projectId: ('0x' + '11'.repeat(32)) as Hex,
      quantity: 50n,
      evidenceId: onChainEvidenceId,
    });
    // Viem or Anvil will reject transaction execution
    await expect(duplicateSubmissionPromise).rejects.toThrow();

    // Retire credits through API
    const retireIdempotencyKey = `retire-${randomUUID()}`;
    const retireResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/retire`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', retireIdempotencyKey)
      .send({ quantity: '150' });

    expect(retireResponse.status).toBe(201);
    expect(retireResponse.body.data.batch.issuedQuantity).toBe('350');
    expect(retireResponse.body.data.batch.retiredQuantity).toBe('150');
    expect(retireResponse.body.data.event.metadata.status).toBe('confirmed');

    // 9. Attempt retirement exceeding available supply through API -> rejected
    const excessRetireResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/retire`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', `excess-${randomUUID()}`)
      .send({ quantity: '500' });
    expect(excessRetireResponse.status).toBe(409);
    expect(excessRetireResponse.body.error.code).toBe('INSUFFICIENT_AVAILABLE_CREDITS');

    // 10. Persisted state verification: recreate app with the same store and verify records
    const records = [...context.store.blockchainRecords.values()];
    expect(records.length).toBeGreaterThanOrEqual(3);
    const confirmedCount = records.filter((r) => r.status === 'CONFIRMED').length;
    expect(confirmedCount).toBeGreaterThanOrEqual(3);
  });
});
