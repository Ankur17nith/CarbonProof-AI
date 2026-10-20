import { createHash, randomUUID } from 'node:crypto';

export type Role = 'PUBLIC' | 'CONTRIBUTOR' | 'REVIEWER' | 'ADMIN';
export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED_INTERNAL'
  | 'REJECTED';
export type AssessmentStatus =
  | 'VALIDATION_ERROR'
  | 'COMPLETED_WITH_FINDINGS'
  | 'COMPLETED_NO_FINDINGS'
  | 'FAILED';
export type ReviewDecision = 'APPROVED_FOR_INTERNAL_REVIEW' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE';
export type CreditLifecycleStatus =
  | 'REGISTERED'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED'
  | 'PARTIALLY_RETIRED'
  | 'FULLY_RETIRED';
export type CreditEventType = 'ISSUED' | 'RETIRED';
export type BlockchainRecordStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  projectType: string;
  methodology: string;
  countryOrRegion?: string;
  registryName?: string;
  externalProjectId?: string;
  externalProjectUrl?: string;
  projectStatus: ProjectStatus;
  dataOrigin: 'USER_SUBMITTED' | 'REGISTRY_REFERENCE' | 'SYNTHETIC_DEMO';
  isSynthetic: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  projectId: string;
  evidenceType: string;
  title: string;
  description?: string;
  originalFilename?: string;
  mediaType: string;
  fileSize: number;
  storageKey?: string;
  sha256: string;
  sourceUrl?: string;
  sourceIdentifier?: string;
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
  structuredData?: unknown;
  submittedById: string;
  provenanceType: 'PRIMARY_SOURCE' | 'REGISTRY_REFERENCE' | 'USER_ASSERTED' | 'SYNTHETIC';
  createdAt: string;
  isPublic: boolean;
}

export interface Assessment {
  id: string;
  projectId: string;
  assessmentVersion: string;
  ruleSetVersion: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  assessmentStatus: AssessmentStatus;
  findingsSummary: Record<string, unknown>;
  evidenceSnapshot: unknown;
  assessedAt: string;
  createdById: string;
  createdAt: string;
}

export interface AssessmentFinding {
  id: string;
  assessmentId: string;
  ruleId: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  title: string;
  explanation: string;
  affectedEvidenceIds: string[];
  affectedFields: string[];
  observedValues?: unknown;
  expectedCondition: string;
  recommendation: string;
  createdAt: string;
}

export interface Review {
  id: string;
  assessmentId: string;
  reviewerId: string;
  decision: ReviewDecision;
  rationale: string;
  createdAt: string;
}

export interface CreditBatch {
  id: string;
  projectId: string;
  externalRegistryReference?: string;
  batchReference: string;
  unit: string;
  totalQuantity: bigint;
  issuedQuantity: bigint;
  retiredQuantity: bigint;
  lifecycleStatus: CreditLifecycleStatus;
  contractAddress?: string;
  chainId?: number;
  onChainRecordId?: string;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditLifecycleEvent {
  id: string;
  creditBatchId: string;
  eventType: CreditEventType;
  quantity: bigint;
  actorId: string;
  transactionHash?: string;
  blockNumber?: bigint;
  idempotencyKey: string;
  metadata?: unknown;
  createdAt: string;
}

export interface BlockchainRecord {
  id: string;
  recordType: string;
  entityId: string;
  chainId: number;
  contractAddress: string;
  transactionHash?: string;
  blockNumber?: bigint;
  recordIdentifier: string;
  payloadHash: string;
  status: BlockchainRecordStatus;
  confirmations: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IdempotencyRecord {
  scope: string;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: string;
  expiresAt: string;
}

export function id(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

export function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}
