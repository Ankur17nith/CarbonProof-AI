import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { carbonCreditRegistryAbi } from './abi.js';

export {
  CARBON_CREDIT_REGISTRY_ABI,
  carbonCreditRegistryAbi,
  DEFAULT_ADMIN_ROLE,
  EVIDENCE_ROLE,
  MINTER_ROLE,
  PAUSER_ROLE,
  RETIRER_ROLE,
} from './abi.js';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const BYTES32_PATTERN = HASH_PATTERN;

export type BlockchainHealthStatus = 'disabled' | 'healthy' | 'degraded' | 'unhealthy';
export type ContractReachability = 'verified' | 'missing' | 'unverified' | 'not_checked';

export interface BlockchainHealth {
  status: BlockchainHealthStatus;
  enabled: boolean;
  configuredChainId?: number;
  observedChainId?: number;
  contractAddress?: Address;
  rpcReachable: boolean;
  contractReachability: ContractReachability;
  signerConfigured: boolean;
  writable: boolean;
  message: string;
  error?: string;
}

export type SafeReadStatus = 'ok' | 'disabled' | 'unavailable';

export interface SafeReadResult<T> {
  status: SafeReadStatus;
  value: T | null;
  error?: string;
}

export interface EvidenceRecord {
  uri: string;
  contentHash: Hex;
  registeredBy: Address;
  registeredAt: bigint;
}

export interface CreditBalance {
  issued: bigint;
  retired: bigint;
  available: bigint;
}

export type Quantity = bigint | number | string;

export interface RegisterEvidenceInput {
  evidenceId: Hex;
  uri: string;
  contentHash: Hex;
}

export interface RegisterEvidenceBatchInput {
  evidenceIds: readonly Hex[];
  uris: readonly string[];
  contentHashes: readonly Hex[];
}

export interface IssueCreditsInput {
  operationId: Hex;
  projectId: Hex;
  quantity: Quantity;
  evidenceId: Hex;
}

export interface RetireCreditsInput {
  operationId: Hex;
  projectId: Hex;
  quantity: Quantity;
}

export interface RoleInput {
  role: Hex;
  account: string;
}

export interface RenounceRoleInput {
  role: Hex;
  callerConfirmation: string;
}

export type BlockchainWriteRequest =
  | { functionName: 'registerEvidence'; args: readonly [Hex, string, Hex] }
  | {
      functionName: 'registerEvidenceBatch';
      args: readonly [readonly Hex[], readonly string[], readonly Hex[]];
    }
  | { functionName: 'issueCredits'; args: readonly [Hex, Hex, bigint, Hex] }
  | { functionName: 'retireCredits'; args: readonly [Hex, Hex, bigint] }
  | { functionName: 'grantRole'; args: readonly [Hex, Address] }
  | { functionName: 'revokeRole'; args: readonly [Hex, Address] }
  | { functionName: 'renounceRole'; args: readonly [Hex, Address] }
  | { functionName: 'pause'; args: readonly [] }
  | { functionName: 'unpause'; args: readonly [] };

export interface SubmittedTransaction {
  status: 'submitted';
  hash: Hash;
  chainId: number;
  contractAddress: Address;
  functionName: BlockchainWriteRequest['functionName'];
}

export interface BlockchainTransactionReceipt {
  status: 'success' | 'reverted';
  transactionHash: Hash;
  blockNumber: bigint;
  gasUsed?: bigint;
}

export interface ConfirmedTransaction {
  status: 'confirmed';
  hash: Hash;
  chainId: number;
  contractAddress: Address;
  confirmations: number;
  blockNumber: bigint;
  receipt: BlockchainTransactionReceipt;
}

export interface BlockchainPublicClient {
  getChainId(): Promise<number>;
  getBytecode?(args: { address: Address }): Promise<Hex | undefined>;
  readContract(args: {
    address: Address;
    abi: typeof carbonCreditRegistryAbi;
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
  waitForTransactionReceipt(args: {
    hash: Hash;
    confirmations: number;
  }): Promise<BlockchainTransactionReceipt>;
}

export interface BlockchainWalletClient {
  account?: Account | Address;
  writeContract(args: {
    address: Address;
    abi: typeof carbonCreditRegistryAbi;
    functionName: BlockchainWriteRequest['functionName'];
    args: readonly unknown[];
    account: Account | Address;
    chain: Chain;
  }): Promise<Hash>;
}

export interface BlockchainAdapterOptions {
  enabled?: boolean;
  rpcUrl?: string;
  chainId?: number;
  contractAddress?: string;
  signerPrivateKey?: string;
  confirmations?: number;
  publicClient?: BlockchainPublicClient;
  walletClient?: BlockchainWalletClient;
  account?: Account | Address;
}

export interface BlockchainAdapter {
  readonly enabled: boolean;
  readonly chainId?: number;
  readonly contractAddress?: Address;

  health(): Promise<BlockchainHealth>;

  getEvidence(evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>>;
  readEvidence(evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>>;
  getCreditBalance(projectId: Hex): Promise<SafeReadResult<CreditBalance>>;
  readCreditBalance(projectId: Hex): Promise<SafeReadResult<CreditBalance>>;
  evidenceExists(evidenceId: Hex): Promise<SafeReadResult<boolean>>;
  operationUsed(operationId: Hex): Promise<SafeReadResult<boolean>>;
  hasRole(role: Hex, account: string): Promise<SafeReadResult<boolean>>;
  paused(): Promise<SafeReadResult<boolean>>;

  submitTransaction(request: BlockchainWriteRequest): Promise<SubmittedTransaction>;
  registerEvidence(input: RegisterEvidenceInput): Promise<SubmittedTransaction>;
  registerEvidenceBatch(input: RegisterEvidenceBatchInput): Promise<SubmittedTransaction>;
  issueCredits(input: IssueCreditsInput): Promise<SubmittedTransaction>;
  retireCredits(input: RetireCreditsInput): Promise<SubmittedTransaction>;
  grantRole(input: RoleInput): Promise<SubmittedTransaction>;
  revokeRole(input: RoleInput): Promise<SubmittedTransaction>;
  renounceRole(input: RenounceRoleInput): Promise<SubmittedTransaction>;
  pause(): Promise<SubmittedTransaction>;
  unpause(): Promise<SubmittedTransaction>;

  confirmTransaction(hash: Hash, confirmations?: number): Promise<ConfirmedTransaction>;
  submitAndConfirm(
    request: BlockchainWriteRequest,
    confirmations?: number,
  ): Promise<{ submission: SubmittedTransaction; confirmation: ConfirmedTransaction }>;
}

export class BlockchainError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  public constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.cause = cause;
  }
}

export class BlockchainConfigurationError extends BlockchainError {
  public constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'BlockchainConfigurationError';
  }
}

export class BlockchainDisabledError extends BlockchainError {
  public constructor() {
    super('BLOCKCHAIN_DISABLED', 'Blockchain integration is disabled.');
    this.name = 'BlockchainDisabledError';
  }
}

export class ViemBlockchainAdapter implements BlockchainAdapter {
  public readonly enabled = true;
  public readonly chainId: number;
  public readonly contractAddress: Address;

  private readonly rpcUrl?: string;
  private readonly confirmations: number;
  private readonly chain: Chain;
  private readonly account?: Account | Address;
  private readonly publicClient: BlockchainPublicClient;
  private readonly walletClient?: BlockchainWalletClient;

  public constructor(options: Omit<BlockchainAdapterOptions, 'enabled'>) {
    this.chainId = validateChainId(options.chainId);
    this.contractAddress = validateContractAddress(options.contractAddress);
    this.confirmations = validateConfirmations(options.confirmations ?? 1);
    this.rpcUrl = validateRpcUrlIfPresent(options.rpcUrl, options.publicClient);
    this.chain = createChain(this.chainId, this.rpcUrl ?? 'http://127.0.0.1:8545');

    const configuredAccount = createAccount(options.account, options.signerPrivateKey);
    this.account = configuredAccount ?? createAccount(options.walletClient?.account, undefined);
    this.publicClient = options.publicClient ?? createViemPublicClient(this.chain, this.rpcUrl);
    this.walletClient =
      options.walletClient ??
      (this.account ? createViemWalletClient(this.chain, this.rpcUrl, this.account) : undefined);
  }

  public async health(): Promise<BlockchainHealth> {
    const base = {
      enabled: true,
      configuredChainId: this.chainId,
      contractAddress: this.contractAddress,
      signerConfigured: Boolean(this.account),
      writable: Boolean(this.walletClient && this.account),
    };

    try {
      const observedChainId = await this.publicClient.getChainId();
      if (observedChainId !== this.chainId) {
        return {
          ...base,
          status: 'unhealthy',
          observedChainId,
          rpcReachable: true,
          contractReachability: 'not_checked',
          message: 'The RPC endpoint is reachable but reports a different chain ID.',
          error: `Expected chain ID ${this.chainId}, received ${observedChainId}.`,
        };
      }

      const contractReachability = await this.checkContractReachability();
      if (contractReachability === 'missing') {
        return {
          ...base,
          status: 'unhealthy',
          observedChainId,
          rpcReachable: true,
          contractReachability,
          message: 'The configured address has no contract bytecode on the configured chain.',
          error: `No contract bytecode found at ${this.contractAddress}.`,
        };
      }

      const writable = Boolean(this.walletClient && this.account);
      return {
        ...base,
        status: writable ? 'healthy' : 'degraded',
        observedChainId,
        rpcReachable: true,
        contractReachability,
        message: writable
          ? 'Blockchain RPC, chain ID, and contract configuration are healthy.'
          : 'Blockchain reads are healthy, but no signer is configured for transactions.',
      };
    } catch (error) {
      return {
        ...base,
        status: 'unhealthy',
        rpcReachable: false,
        contractReachability: 'not_checked',
        message: 'The blockchain RPC health check failed.',
        error: errorMessage(error),
      };
    }
  }

  public getEvidence(evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>> {
    return this.read(evidenceId, 'evidenceId', 'getEvidence', (value) => {
      if (!Array.isArray(value) || value.length !== 4)
        throw new BlockchainError(
          'BLOCKCHAIN_INVALID_RESPONSE',
          'getEvidence returned an unexpected result.',
        );
      return {
        uri: requireString(value[0], 'uri'),
        contentHash: requireBytes32(value[1], 'contentHash'),
        registeredBy: requireResponseAddress(value[2], 'registeredBy'),
        registeredAt: requireBigint(value[3], 'registeredAt'),
      };
    });
  }

  public readEvidence(evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>> {
    return this.getEvidence(evidenceId);
  }

  public getCreditBalance(projectId: Hex): Promise<SafeReadResult<CreditBalance>> {
    return this.read(projectId, 'projectId', 'getCreditBalance', (value) => {
      if (!Array.isArray(value) || value.length !== 3)
        throw new BlockchainError(
          'BLOCKCHAIN_INVALID_RESPONSE',
          'getCreditBalance returned an unexpected result.',
        );
      return {
        issued: requireBigint(value[0], 'issued'),
        retired: requireBigint(value[1], 'retired'),
        available: requireBigint(value[2], 'available'),
      };
    });
  }

  public readCreditBalance(projectId: Hex): Promise<SafeReadResult<CreditBalance>> {
    return this.getCreditBalance(projectId);
  }

  public evidenceExists(evidenceId: Hex): Promise<SafeReadResult<boolean>> {
    return this.read(evidenceId, 'evidenceId', 'evidenceExists', requireBoolean);
  }

  public operationUsed(operationId: Hex): Promise<SafeReadResult<boolean>> {
    return this.read(operationId, 'operationId', 'operationUsed', requireBoolean);
  }

  public hasRole(role: Hex, account: string): Promise<SafeReadResult<boolean>> {
    const validRole = validateBytes32(role, 'role');
    const validAccount = validateAddress(account, 'account');
    return this.safeRead('hasRole', [validRole, validAccount], requireBoolean);
  }

  public paused(): Promise<SafeReadResult<boolean>> {
    return this.safeRead('paused', [], requireBoolean);
  }

  public async submitTransaction(request: BlockchainWriteRequest): Promise<SubmittedTransaction> {
    const walletClient = this.walletClient;
    const account = this.account ?? walletClient?.account;
    if (!walletClient || !account)
      throw new BlockchainError(
        'BLOCKCHAIN_SIGNER_UNAVAILABLE',
        'A blockchain signer is required to submit transactions.',
      );

    const validated = validateWriteRequest(request);
    try {
      const hash = await walletClient.writeContract({
        address: this.contractAddress,
        abi: carbonCreditRegistryAbi,
        functionName: validated.functionName,
        args: validated.args,
        account,
        chain: this.chain,
      });
      if (!HASH_PATTERN.test(hash))
        throw new BlockchainError(
          'BLOCKCHAIN_INVALID_TRANSACTION_HASH',
          'The wallet returned an invalid transaction hash.',
        );
      return {
        status: 'submitted',
        hash,
        chainId: this.chainId,
        contractAddress: this.contractAddress,
        functionName: validated.functionName,
      };
    } catch (error) {
      if (error instanceof BlockchainError) throw error;
      throw new BlockchainError(
        'BLOCKCHAIN_SUBMISSION_FAILED',
        `Transaction submission failed: ${errorMessage(error)}`,
        error,
      );
    }
  }

  public registerEvidence(input: RegisterEvidenceInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'registerEvidence',
      args: [
        validateBytes32(input.evidenceId, 'evidenceId'),
        input.uri,
        validateBytes32(input.contentHash, 'contentHash'),
      ],
    });
  }

  public registerEvidenceBatch(input: RegisterEvidenceBatchInput): Promise<SubmittedTransaction> {
    if (input.evidenceIds.length === 0)
      throw new BlockchainError('BLOCKCHAIN_INVALID_ARGUMENT', 'evidenceIds must not be empty.');
    if (
      input.evidenceIds.length !== input.uris.length ||
      input.evidenceIds.length !== input.contentHashes.length
    )
      throw new BlockchainError(
        'BLOCKCHAIN_INVALID_ARGUMENT',
        'evidenceIds, uris, and contentHashes must have equal lengths.',
      );
    return this.submitTransaction({
      functionName: 'registerEvidenceBatch',
      args: [
        input.evidenceIds.map((value) => validateBytes32(value, 'evidenceId')),
        [...input.uris],
        input.contentHashes.map((value) => validateBytes32(value, 'contentHash')),
      ],
    });
  }

  public issueCredits(input: IssueCreditsInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'issueCredits',
      args: [
        validateBytes32(input.operationId, 'operationId'),
        validateBytes32(input.projectId, 'projectId'),
        normalizeQuantity(input.quantity, 'quantity'),
        validateBytes32(input.evidenceId, 'evidenceId'),
      ],
    });
  }

  public retireCredits(input: RetireCreditsInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'retireCredits',
      args: [
        validateBytes32(input.operationId, 'operationId'),
        validateBytes32(input.projectId, 'projectId'),
        normalizeQuantity(input.quantity, 'quantity'),
      ],
    });
  }

  public grantRole(input: RoleInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'grantRole',
      args: [validateBytes32(input.role, 'role'), validateAddress(input.account, 'account')],
    });
  }

  public revokeRole(input: RoleInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'revokeRole',
      args: [validateBytes32(input.role, 'role'), validateAddress(input.account, 'account')],
    });
  }

  public renounceRole(input: RenounceRoleInput): Promise<SubmittedTransaction> {
    return this.submitTransaction({
      functionName: 'renounceRole',
      args: [
        validateBytes32(input.role, 'role'),
        validateAddress(input.callerConfirmation, 'callerConfirmation'),
      ],
    });
  }

  public pause(): Promise<SubmittedTransaction> {
    return this.submitTransaction({ functionName: 'pause', args: [] });
  }

  public unpause(): Promise<SubmittedTransaction> {
    return this.submitTransaction({ functionName: 'unpause', args: [] });
  }

  public async confirmTransaction(
    hash: Hash,
    confirmations = this.confirmations,
  ): Promise<ConfirmedTransaction> {
    const validHash = validateHash(hash);
    const validConfirmations = validateConfirmations(confirmations);
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: validHash,
        confirmations: validConfirmations,
      });
      if (receipt.status === 'reverted')
        throw new BlockchainError(
          'BLOCKCHAIN_TRANSACTION_REVERTED',
          `Transaction ${validHash} was mined but reverted.`,
        );
      return {
        status: 'confirmed',
        hash: validHash,
        chainId: this.chainId,
        contractAddress: this.contractAddress,
        confirmations: validConfirmations,
        blockNumber: receipt.blockNumber,
        receipt,
      };
    } catch (error) {
      if (error instanceof BlockchainError) throw error;
      throw new BlockchainError(
        'BLOCKCHAIN_CONFIRMATION_FAILED',
        `Transaction confirmation failed: ${errorMessage(error)}`,
        error,
      );
    }
  }

  public async submitAndConfirm(
    request: BlockchainWriteRequest,
    confirmations = this.confirmations,
  ): Promise<{ submission: SubmittedTransaction; confirmation: ConfirmedTransaction }> {
    const submission = await this.submitTransaction(request);
    const confirmation = await this.confirmTransaction(submission.hash, confirmations);
    return { submission, confirmation };
  }

  private async read<T>(
    value: Hex,
    field: string,
    functionName: string,
    decode: (raw: unknown) => T,
  ): Promise<SafeReadResult<T>> {
    const validValue = validateBytes32(value, field);
    return this.safeRead(functionName, [validValue], decode);
  }

  private async safeRead<T>(
    functionName: string,
    args: readonly unknown[],
    decode: (raw: unknown) => T,
  ): Promise<SafeReadResult<T>> {
    try {
      const raw = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: carbonCreditRegistryAbi,
        functionName,
        args,
      });
      return { status: 'ok', value: decode(raw) };
    } catch (error) {
      return { status: 'unavailable', value: null, error: errorMessage(error) };
    }
  }

  private async checkContractReachability(): Promise<ContractReachability> {
    if (!this.publicClient.getBytecode) return 'unverified';
    const bytecode = await this.publicClient.getBytecode({ address: this.contractAddress });
    return bytecode && bytecode !== '0x' ? 'verified' : 'missing';
  }
}

export class DisabledBlockchainAdapter implements BlockchainAdapter {
  public readonly enabled = false;

  public health(): Promise<BlockchainHealth> {
    return Promise.resolve({
      status: 'disabled',
      enabled: false,
      rpcReachable: false,
      contractReachability: 'not_checked',
      signerConfigured: false,
      writable: false,
      message: 'Blockchain integration is disabled.',
    });
  }

  public getEvidence(_evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>> {
    return Promise.resolve(disabledRead());
  }
  public readEvidence(_evidenceId: Hex): Promise<SafeReadResult<EvidenceRecord>> {
    return Promise.resolve(disabledRead());
  }
  public getCreditBalance(_projectId: Hex): Promise<SafeReadResult<CreditBalance>> {
    return Promise.resolve(disabledRead());
  }
  public readCreditBalance(_projectId: Hex): Promise<SafeReadResult<CreditBalance>> {
    return Promise.resolve(disabledRead());
  }
  public evidenceExists(_evidenceId: Hex): Promise<SafeReadResult<boolean>> {
    return Promise.resolve(disabledRead());
  }
  public operationUsed(_operationId: Hex): Promise<SafeReadResult<boolean>> {
    return Promise.resolve(disabledRead());
  }
  public hasRole(_role: Hex, _account: string): Promise<SafeReadResult<boolean>> {
    return Promise.resolve(disabledRead());
  }
  public paused(): Promise<SafeReadResult<boolean>> {
    return Promise.resolve(disabledRead());
  }

  public submitTransaction(_request: BlockchainWriteRequest): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public registerEvidence(_input: RegisterEvidenceInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public registerEvidenceBatch(_input: RegisterEvidenceBatchInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public issueCredits(_input: IssueCreditsInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public retireCredits(_input: RetireCreditsInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public grantRole(_input: RoleInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public revokeRole(_input: RoleInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public renounceRole(_input: RenounceRoleInput): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public pause(): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public unpause(): Promise<SubmittedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public confirmTransaction(_hash: Hash, _confirmations?: number): Promise<ConfirmedTransaction> {
    return Promise.reject(new BlockchainDisabledError());
  }
  public submitAndConfirm(
    _request: BlockchainWriteRequest,
    _confirmations?: number,
  ): Promise<{ submission: SubmittedTransaction; confirmation: ConfirmedTransaction }> {
    return Promise.reject(new BlockchainDisabledError());
  }
}

export function createBlockchainAdapter(options: BlockchainAdapterOptions = {}): BlockchainAdapter {
  if (!options.enabled) return new DisabledBlockchainAdapter();
  return new ViemBlockchainAdapter(options);
}

function createViemPublicClient(chain: Chain, rpcUrl?: string): BlockchainPublicClient {
  if (!rpcUrl)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_RPC_URL_REQUIRED',
      'rpcUrl is required when no public client is supplied.',
    );
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as unknown as BlockchainPublicClient;
}

function createViemWalletClient(
  chain: Chain,
  rpcUrl: string | undefined,
  account: Account | Address,
): BlockchainWalletClient {
  if (!rpcUrl)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_RPC_URL_REQUIRED',
      'rpcUrl is required when no wallet client is supplied.',
    );
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  }) as unknown as BlockchainWalletClient;
}

function createChain(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: `CarbonProof chain ${chainId}`,
    nativeCurrency: { name: 'Native', symbol: 'NATIVE', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  };
}

function createAccount(
  account: Account | Address | undefined,
  privateKey: string | undefined,
): Account | Address | undefined {
  if (account && privateKey)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_MULTIPLE_SIGNERS',
      'Provide either account or signerPrivateKey, not both.',
    );
  if (account) return typeof account === 'string' ? validateAddress(account, 'account') : account;
  if (!privateKey) return undefined;
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey))
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_PRIVATE_KEY',
      'signerPrivateKey must be a 32-byte hexadecimal private key.',
    );
  try {
    return privateKeyToAccount(privateKey as Hex);
  } catch (error) {
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_PRIVATE_KEY',
      'signerPrivateKey is invalid.',
      error,
    );
  }
}

function validateChainId(chainId: number | undefined): number {
  if (chainId === undefined || !Number.isSafeInteger(chainId) || chainId <= 0)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_CHAIN_ID',
      'chainId must be a positive safe integer.',
    );
  return chainId;
}

function validateContractAddress(address: string | undefined): Address {
  if (!address)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_CONTRACT_ADDRESS_REQUIRED',
      'contractAddress is required when blockchain integration is enabled.',
    );
  return validateAddress(address, 'contractAddress', true);
}

function validateRpcUrlIfPresent(
  rpcUrl: string | undefined,
  publicClient: BlockchainPublicClient | undefined,
): string | undefined {
  if (!rpcUrl && publicClient) return undefined;
  if (!rpcUrl)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_RPC_URL_REQUIRED',
      'rpcUrl is required when blockchain integration is enabled.',
    );
  try {
    const parsed = new URL(rpcUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    return parsed.toString();
  } catch (error) {
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_RPC_URL',
      'rpcUrl must be a valid HTTP or HTTPS URL.',
      error,
    );
  }
}

function validateConfirmations(confirmations: number): number {
  if (!Number.isSafeInteger(confirmations) || confirmations < 1)
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_CONFIRMATIONS',
      'confirmations must be a positive integer.',
    );
  return confirmations;
}

function validateAddress(value: string, field: string, rejectZero = false): Address {
  try {
    const address = getAddress(value);
    if (rejectZero && address.toLowerCase() === ZERO_ADDRESS) throw new Error('zero address');
    return address;
  } catch (error) {
    throw new BlockchainConfigurationError(
      'BLOCKCHAIN_INVALID_ADDRESS',
      `${field} must be a valid Ethereum address${rejectZero ? ' other than the zero address' : ''}.`,
      error,
    );
  }
}

function validateBytes32(value: string, field: string): Hex {
  if (typeof value !== 'string' || !BYTES32_PATTERN.test(value))
    throw new BlockchainError(
      'BLOCKCHAIN_INVALID_ARGUMENT',
      `${field} must be a 32-byte hexadecimal value.`,
    );
  return value as Hex;
}

function validateHash(value: string): Hash {
  if (!HASH_PATTERN.test(value))
    throw new BlockchainError(
      'BLOCKCHAIN_INVALID_TRANSACTION_HASH',
      'Transaction hash must be a 32-byte hexadecimal value.',
    );
  return value as Hash;
}

function normalizeQuantity(value: Quantity, field: string): bigint {
  try {
    const quantity = BigInt(value);
    if (quantity <= 0n) throw new Error('not positive');
    return quantity;
  } catch (error) {
    throw new BlockchainError(
      'BLOCKCHAIN_INVALID_ARGUMENT',
      `${field} must be a positive integer quantity.`,
      error,
    );
  }
}

function validateWriteRequest(request: BlockchainWriteRequest): BlockchainWriteRequest {
  switch (request.functionName) {
    case 'registerEvidence':
      return {
        functionName: request.functionName,
        args: [
          validateBytes32(request.args[0], 'evidenceId'),
          request.args[1],
          validateBytes32(request.args[2], 'contentHash'),
        ],
      };
    case 'registerEvidenceBatch':
      if (
        request.args[0].length === 0 ||
        request.args[0].length !== request.args[1].length ||
        request.args[0].length !== request.args[2].length
      )
        throw new BlockchainError(
          'BLOCKCHAIN_INVALID_ARGUMENT',
          'registerEvidenceBatch arrays must be non-empty and have equal lengths.',
        );
      return {
        functionName: request.functionName,
        args: [
          request.args[0].map((value) => validateBytes32(value, 'evidenceId')),
          [...request.args[1]],
          request.args[2].map((value) => validateBytes32(value, 'contentHash')),
        ],
      };
    case 'issueCredits':
      return {
        functionName: request.functionName,
        args: [
          validateBytes32(request.args[0], 'operationId'),
          validateBytes32(request.args[1], 'projectId'),
          normalizeQuantity(request.args[2], 'quantity'),
          validateBytes32(request.args[3], 'evidenceId'),
        ],
      };
    case 'retireCredits':
      return {
        functionName: request.functionName,
        args: [
          validateBytes32(request.args[0], 'operationId'),
          validateBytes32(request.args[1], 'projectId'),
          normalizeQuantity(request.args[2], 'quantity'),
        ],
      };
    case 'grantRole':
    case 'revokeRole':
      return {
        functionName: request.functionName,
        args: [
          validateBytes32(request.args[0], 'role'),
          validateAddress(request.args[1], 'account'),
        ],
      };
    case 'renounceRole':
      return {
        functionName: request.functionName,
        args: [
          validateBytes32(request.args[0], 'role'),
          validateAddress(request.args[1], 'callerConfirmation'),
        ],
      };
    case 'pause':
    case 'unpause':
      if (request.args.length !== 0)
        throw new BlockchainError(
          'BLOCKCHAIN_INVALID_ARGUMENT',
          `${request.functionName} does not accept arguments.`,
        );
      return request;
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new BlockchainError('BLOCKCHAIN_INVALID_RESPONSE', `${field} was not a string.`);
  return value;
}

function requireBytes32(value: unknown, field: string): Hex {
  if (typeof value !== 'string' || !BYTES32_PATTERN.test(value))
    throw new BlockchainError('BLOCKCHAIN_INVALID_RESPONSE', `${field} was not a bytes32 value.`);
  return value as Hex;
}

function requireResponseAddress(value: unknown, field: string): Address {
  if (typeof value !== 'string')
    throw new BlockchainError('BLOCKCHAIN_INVALID_RESPONSE', `${field} was not an address.`);
  try {
    return getAddress(value);
  } catch (error) {
    throw new BlockchainError(
      'BLOCKCHAIN_INVALID_RESPONSE',
      `${field} was not a valid address.`,
      error,
    );
  }
}

function requireBigint(value: unknown, field: string): bigint {
  if (typeof value !== 'bigint')
    throw new BlockchainError('BLOCKCHAIN_INVALID_RESPONSE', `${field} was not a bigint.`);
  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean')
    throw new BlockchainError(
      'BLOCKCHAIN_INVALID_RESPONSE',
      'The contract returned a non-boolean value.',
    );
  return value;
}

function disabledRead<T>(): SafeReadResult<T> {
  return { status: 'disabled', value: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
