export type Role = 'PUBLIC' | 'CONTRIBUTOR' | 'REVIEWER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: User;
}

export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED_INTERNAL'
  | 'REJECTED';

export type DataOrigin = 'USER_SUBMITTED' | 'REGISTRY_REFERENCE' | 'SYNTHETIC_DEMO';

export type ProvenanceType =
  | 'PRIMARY_SOURCE'
  | 'REGISTRY_REFERENCE'
  | 'USER_ASSERTED'
  | 'SYNTHETIC';

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
  dataOrigin: DataOrigin;
  isSynthetic: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type BlockchainWorkflowStatus =
  | 'disabled'
  | 'not_attempted'
  | 'pending'
  | 'confirmed'
  | 'failed';

export interface BlockchainWorkflowMetadata {
  enabled: boolean;
  status: BlockchainWorkflowStatus;
  recordId?: string;
  recordIdentifier?: string;
  transactionHash?: string;
  blockNumber?: string | number | bigint;
  confirmations?: number;
  error?: string;
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
  provenanceType: ProvenanceType;
  isPublic: boolean;
  createdAt: string;
  blockchain?: BlockchainWorkflowMetadata;
}

export type FindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssessmentStatus =
  | 'VALIDATION_ERROR'
  | 'COMPLETED_WITH_FINDINGS'
  | 'COMPLETED_NO_FINDINGS'
  | 'FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AssessmentFinding {
  id: string;
  assessmentId: string;
  ruleId: string;
  severity: FindingSeverity;
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

export interface Assessment {
  id: string;
  projectId: string;
  assessmentVersion: string;
  ruleSetVersion: string;
  riskScore: number;
  riskLevel: RiskLevel;
  assessmentStatus: AssessmentStatus;
  findingsSummary: Record<string, unknown>;
  evidenceSnapshot: unknown;
  assessedAt: string;
  createdById: string;
  createdAt: string;
  findings?: AssessmentFinding[];
}

export type ReviewDecision =
  | 'APPROVED_FOR_INTERNAL_REVIEW'
  | 'REJECTED'
  | 'NEEDS_MORE_EVIDENCE';

export interface Review {
  id: string;
  assessmentId: string;
  reviewerId: string;
  decision: ReviewDecision;
  rationale: string;
  createdAt: string;
  reviewer?: User;
}

export type CreditLifecycleStatus =
  | 'REGISTERED'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED'
  | 'PARTIALLY_RETIRED'
  | 'FULLY_RETIRED';

export type CreditEventType = 'ISSUED' | 'RETIRED';

export interface CreditBatch {
  id: string;
  projectId: string;
  externalRegistryReference?: string;
  batchReference: string;
  unit: string;
  totalQuantity: string;
  issuedQuantity: string;
  retiredQuantity: string;
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
  quantity: string;
  actorId: string;
  transactionHash?: string;
  blockNumber?: string | number | bigint;
  idempotencyKey: string;
  metadata?: unknown;
  createdAt: string;
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

export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: ApiErrorDetail[];
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
