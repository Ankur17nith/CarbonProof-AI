import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import {
  BlockchainConfigurationError,
  BlockchainDisabledError,
  type BlockchainPublicClient,
  type BlockchainWalletClient,
  carbonCreditRegistryAbi,
  createBlockchainAdapter,
} from '../src/blockchain/index.js';

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001' as const;
const SIGNER_ADDRESS = '0x0000000000000000000000000000000000000002' as const;
const EVIDENCE_ID = `0x${'11'.repeat(32)}` as Hex;
const PROJECT_ID = `0x${'22'.repeat(32)}` as Hex;
const OPERATION_ID = `0x${'33'.repeat(32)}` as Hex;
const CONTENT_HASH = `0x${'44'.repeat(32)}` as Hex;
const TRANSACTION_HASH = `0x${'aa'.repeat(32)}` as Hex;

function publicClient(overrides: Partial<BlockchainPublicClient> = {}): BlockchainPublicClient {
  return {
    getChainId: vi.fn().mockResolvedValue(31337),
    getBytecode: vi.fn().mockResolvedValue('0x6000' as Hex),
    readContract: vi.fn().mockResolvedValue(true),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      transactionHash: TRANSACTION_HASH,
      blockNumber: 42n,
    }),
    ...overrides,
  };
}

describe('server-side CarbonCreditRegistry blockchain adapter', () => {
  it('keeps disabled mode credential-free, safe for reads, and explicit for writes', async () => {
    const adapter = createBlockchainAdapter({ enabled: false });

    await expect(adapter.health()).resolves.toMatchObject({
      status: 'disabled',
      enabled: false,
      writable: false,
      signerConfigured: false,
    });
    await expect(adapter.getCreditBalance(PROJECT_ID)).resolves.toEqual({
      status: 'disabled',
      value: null,
    });
    await expect(adapter.pause()).rejects.toBeInstanceOf(BlockchainDisabledError);
  });

  it('validates enabled chain configuration before creating a client', () => {
    expect(() =>
      createBlockchainAdapter({
        enabled: true,
        chainId: 0,
        contractAddress: CONTRACT_ADDRESS,
        rpcUrl: 'http://127.0.0.1:8545',
      }),
    ).toThrow(BlockchainConfigurationError);
    expect(() =>
      createBlockchainAdapter({
        enabled: true,
        chainId: 31337,
        contractAddress: 'not-an-address',
        rpcUrl: 'http://127.0.0.1:8545',
      }),
    ).toThrow(/contractAddress/);
    expect(() =>
      createBlockchainAdapter({
        enabled: true,
        chainId: 31337,
        contractAddress: `0x${'00'.repeat(20)}`,
        rpcUrl: 'http://127.0.0.1:8545',
      }),
    ).toThrow(/zero address/);
  });

  it('performs safe contract reads without requiring a signer', async () => {
    const client = publicClient({
      readContract: vi
        .fn()
        .mockImplementation(({ functionName }: { functionName: string }) =>
          functionName === 'getEvidence'
            ? ['ipfs://evidence', CONTENT_HASH, SIGNER_ADDRESS, 123n]
            : [10n, 2n, 8n],
        ),
    });
    const adapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: client,
    });

    await expect(adapter.getEvidence(EVIDENCE_ID)).resolves.toEqual({
      status: 'ok',
      value: {
        uri: 'ipfs://evidence',
        contentHash: CONTENT_HASH,
        registeredBy: SIGNER_ADDRESS,
        registeredAt: 123n,
      },
    });
    await expect(adapter.getCreditBalance(PROJECT_ID)).resolves.toEqual({
      status: 'ok',
      value: { issued: 10n, retired: 2n, available: 8n },
    });

    const failingClient = publicClient({
      readContract: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
    });
    const failingAdapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: failingClient,
    });
    await expect(failingAdapter.evidenceExists(EVIDENCE_ID)).resolves.toMatchObject({
      status: 'unavailable',
      value: null,
      error: 'RPC unavailable',
    });
  });

  it('reports chain, contract, and signer health instead of only configured state', async () => {
    const healthyClient = publicClient();
    const writableClient = {
      writeContract: vi.fn().mockResolvedValue(TRANSACTION_HASH),
    } satisfies BlockchainWalletClient;
    const adapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: healthyClient,
      walletClient: writableClient,
      account: SIGNER_ADDRESS,
    });
    await expect(adapter.health()).resolves.toMatchObject({
      status: 'healthy',
      rpcReachable: true,
      contractReachability: 'verified',
      writable: true,
      observedChainId: 31337,
    });

    const mismatchAdapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: publicClient({ getChainId: vi.fn().mockResolvedValue(1) }),
    });
    await expect(mismatchAdapter.health()).resolves.toMatchObject({
      status: 'unhealthy',
      rpcReachable: true,
      observedChainId: 1,
    });
  });

  it('submits real contract calls and returns the wallet hash without inventing one', async () => {
    const writeContractMock = vi.fn().mockResolvedValue(TRANSACTION_HASH);
    const writeContract = writeContractMock as unknown as BlockchainWalletClient['writeContract'];
    const adapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: publicClient(),
      walletClient: { writeContract },
      account: SIGNER_ADDRESS,
    });

    const submission = await adapter.issueCredits({
      operationId: OPERATION_ID,
      projectId: PROJECT_ID,
      quantity: '7',
      evidenceId: EVIDENCE_ID,
    });

    expect(submission).toEqual({
      status: 'submitted',
      hash: TRANSACTION_HASH,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      functionName: 'issueCredits',
    });
    expect(writeContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACT_ADDRESS,
        functionName: 'issueCredits',
        args: [OPERATION_ID, PROJECT_ID, 7n, EVIDENCE_ID],
        account: SIGNER_ADDRESS,
      }),
    );
    expect(writeContractMock.mock.calls[0]?.[0].abi).toBe(carbonCreditRegistryAbi);
  });

  it('waits for the requested receipt confirmations and rejects mined reverts', async () => {
    const receiptClient = publicClient();
    const adapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: receiptClient,
    });

    await expect(adapter.confirmTransaction(TRANSACTION_HASH, 3)).resolves.toMatchObject({
      status: 'confirmed',
      hash: TRANSACTION_HASH,
      confirmations: 3,
      blockNumber: 42n,
    });
    expect(receiptClient.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: TRANSACTION_HASH,
      confirmations: 3,
    });

    const revertedClient = publicClient({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'reverted',
        transactionHash: TRANSACTION_HASH,
        blockNumber: 43n,
      }),
    });
    const revertedAdapter = createBlockchainAdapter({
      enabled: true,
      chainId: 31337,
      contractAddress: CONTRACT_ADDRESS,
      publicClient: revertedClient,
    });
    await expect(revertedAdapter.confirmTransaction(TRANSACTION_HASH)).rejects.toMatchObject({
      code: 'BLOCKCHAIN_TRANSACTION_REVERTED',
    });
  });
});
