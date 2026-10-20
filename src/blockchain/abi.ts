import { keccak256, parseAbi, toBytes, type Hex } from 'viem';

/**
 * The callable ABI for contracts/src/CarbonCreditRegistry.sol.
 *
 * Keeping this ABI next to the adapter prevents contract details from leaking
 * into the rest of the server and makes every write an explicit contract call.
 */
export const carbonCreditRegistryAbi = parseAbi([
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
  'error AccessControlBadConfirmation()',
  'error AlreadyExists(bytes32 identifier)',
  'error ArrayLengthMismatch()',
  'error DuplicateOperationId(bytes32 operationId)',
  'error EmptyBatch()',
  'error EnforcedPause()',
  'error ExpectedPause()',
  'error InsufficientCredits(bytes32 projectId, uint256 requested, uint256 available)',
  'error InvalidIdentifier()',
  'error InvalidQuantity()',
  'error UnknownEvidence(bytes32 evidenceId)',
  'error ZeroAddress()',
  'event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
  'event EvidenceRegistered(bytes32 indexed evidenceId, bytes32 indexed contentHash, string uri, address indexed registeredBy)',
  'event CreditsIssued(bytes32 indexed operationId, bytes32 indexed projectId, bytes32 indexed evidenceId, uint256 quantity, address issuer)',
  'event CreditsRetired(bytes32 indexed operationId, bytes32 indexed projectId, uint256 quantity, address retiree)',
  'event Paused(address account)',
  'event Unpaused(address account)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function EVIDENCE_ROLE() view returns (bytes32)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function RETIRER_ROLE() view returns (bytes32)',
  'function PAUSER_ROLE() view returns (bytes32)',
  'function evidenceExists(bytes32 evidenceId) view returns (bool)',
  'function operationUsed(bytes32 operationId) view returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function getRoleAdmin(bytes32 role) view returns (bytes32)',
  'function getEvidence(bytes32 evidenceId) view returns (string uri, bytes32 contentHash, address registeredBy, uint256 registeredAt)',
  'function getCreditBalance(bytes32 projectId) view returns (uint256 issued, uint256 retired, uint256 available)',
  'function paused() view returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',
  'function renounceRole(bytes32 role, address callerConfirmation)',
  'function registerEvidence(bytes32 evidenceId, string uri, bytes32 contentHash)',
  'function registerEvidenceBatch(bytes32[] evidenceIds, string[] uris, bytes32[] contentHashes)',
  'function issueCredits(bytes32 operationId, bytes32 projectId, uint256 quantity, bytes32 evidenceId)',
  'function retireCredits(bytes32 operationId, bytes32 projectId, uint256 quantity)',
  'function pause()',
  'function unpause()',
] as const);

export const CARBON_CREDIT_REGISTRY_ABI = carbonCreditRegistryAbi;

export const DEFAULT_ADMIN_ROLE = `0x${'00'.repeat(32)}` as Hex;
export const EVIDENCE_ROLE = keccak256(toBytes('EVIDENCE_ROLE'));
export const MINTER_ROLE = keccak256(toBytes('MINTER_ROLE'));
export const RETIRER_ROLE = keccak256(toBytes('RETIRER_ROLE'));
export const PAUSER_ROLE = keccak256(toBytes('PAUSER_ROLE'));
