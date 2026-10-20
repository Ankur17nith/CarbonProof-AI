export type NumericValue = number | string | bigint;

export type JsonPrimitive = null | boolean | number | string;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface ReportingPeriod {
  readonly start: string;
  readonly end: string;
}

export interface RequiredEvidenceRequirement {
  readonly evidenceType: string;
  readonly minimumCount?: number;
}

export interface ProvenanceRecord {
  readonly type?: string;
  readonly source?: string;
  readonly sourceUrl?: string;
  readonly capturedAt?: string;
}

export type EvidenceReference =
  | string
  | {
      readonly id?: string;
      readonly evidenceId?: string;
      readonly reference?: string;
      readonly externalReference?: string;
    };

export interface CreditEvent {
  readonly type?: string;
  readonly eventType?: string;
  readonly quantity?: NumericValue | null;
}

export interface CreditQuantityClaim {
  readonly totalQuantity?: NumericValue | null;
  readonly issuedQuantity?: NumericValue | null;
  readonly retiredQuantity?: NumericValue | null;
  readonly unit?: string | null;
  readonly events?: readonly CreditEvent[] | null;
}

export interface CreditBatchClaim extends CreditQuantityClaim {
  readonly id?: string;
  readonly batchReference?: string;
}

export interface VerificationProject {
  readonly id: string;
  readonly externalProjectId?: string | null;
  readonly projectIdentifier?: string | null;
  readonly registryName?: string | null;
  readonly reportingPeriod?: ReportingPeriod | null;
  readonly reportingPeriodStart?: string | null;
  readonly reportingPeriodEnd?: string | null;
  readonly unit?: string | null;
  readonly quantity?: NumericValue | null;
  readonly requiredEvidence?: readonly (string | RequiredEvidenceRequirement)[] | null;
  readonly requiredEvidenceTypes?: readonly string[] | null;
  readonly creditQuantity?: NumericValue | null;
  readonly credit?: CreditQuantityClaim | null;
  readonly creditBatches?: readonly CreditBatchClaim[] | null;
}

export interface VerificationEvidence {
  readonly id: string;
  readonly evidenceType: string;
  readonly projectId?: string | null;
  readonly projectIdentifier?: string | null;
  readonly externalProjectId?: string | null;
  readonly sha256?: string | null;
  readonly evidenceHash?: string | null;
  readonly externalReference?: string | null;
  readonly sourceIdentifier?: string | null;
  readonly reportingPeriod?: ReportingPeriod | null;
  readonly reportingPeriodStart?: string | null;
  readonly reportingPeriodEnd?: string | null;
  readonly unit?: string | null;
  readonly quantity?: NumericValue | null;
  readonly structuredData?: unknown;
  readonly provenance?: ProvenanceRecord | string | null;
  readonly provenanceType?: string | null;
  readonly sourceUrl?: string | null;
  readonly references?: readonly EvidenceReference[] | null;
  readonly evidenceReferences?: readonly EvidenceReference[] | null;
}

export type PeriodMatchMode = 'exact' | 'contained';

export enum FindingSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum VerificationStatus {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  COMPLETED_WITH_FINDINGS = 'COMPLETED_WITH_FINDINGS',
  COMPLETED_NO_FINDINGS = 'COMPLETED_NO_FINDINGS',
  FAILED = 'FAILED',
}

export const AssessmentStatus = VerificationStatus;

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum VerificationRuleId {
  REQUIRED_EVIDENCE_MISSING = 'required-evidence-missing',
  PROJECT_IDENTIFIER_MISMATCH = 'project-identifier-mismatch',
  REPORTING_PERIOD_INCONSISTENCY = 'reporting-period-inconsistency',
  INVALID_BOUNDARIES = 'invalid-boundaries',
  UNIT_MISMATCH = 'unit-mismatch',
  QUANTITY_INCONSISTENCY = 'quantity-inconsistency',
  DUPLICATE_EVIDENCE_HASH = 'duplicate-evidence-hash',
  DUPLICATE_EXTERNAL_REFERENCE = 'duplicate-external-reference',
  MALFORMED_STRUCTURED_EVIDENCE = 'malformed-structured-evidence',
  MISSING_PROVENANCE = 'missing-provenance',
  INVALID_NUMERIC_VALUES = 'invalid-numeric-values',
  REPEATED_EVIDENCE_REFERENCES = 'repeated-evidence-references',
  CONTRADICTORY_STRUCTURED_CLAIMS = 'contradictory-structured-claims',
  CREDIT_QUANTITY_INCONSISTENCY = 'credit-quantity-inconsistency',
}

export interface VerificationConfig {
  readonly requiredEvidence?: readonly (string | RequiredEvidenceRequirement)[];
  readonly requiredEvidenceTypes?: readonly string[];
  readonly enabledRuleIds?: readonly string[];
  readonly disabledRuleIds?: readonly string[];
  readonly ruleWeights?: Readonly<Record<string, number>>;
  readonly severityMultipliers?: Readonly<Partial<Record<FindingSeverity, number>>>;
  readonly quantityTolerance?: NumericValue;
  readonly periodMatchMode?: PeriodMatchMode;
}

export interface VerificationRequest {
  readonly project: VerificationProject;
  readonly evidence: readonly VerificationEvidence[];
  readonly config?: VerificationConfig;
}

export interface VerificationValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface FindingDraft {
  readonly ruleId: string;
  readonly severity: FindingSeverity;
  readonly category: string;
  readonly title: string;
  readonly message: string;
  readonly affectedEvidenceIds: readonly string[];
  readonly affectedFields: readonly string[];
  readonly observedValues?: JsonValue;
  readonly expectedCondition: string;
  readonly recommendation: string;
  readonly deduplicationKey: string;
}

export interface VerificationFinding extends FindingDraft {
  readonly id: string;
  readonly explanation: string;
  readonly fingerprint: string;
}

export interface ScoreBreakdownEntry {
  readonly ruleId: string;
  readonly findingCount: number;
  readonly configuredWeight: number;
  readonly severityMultiplier: number;
  readonly penalty: number;
}

export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly score: number;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly ruleSetVersion: string;
  readonly findings: readonly VerificationFinding[];
  readonly scoreBreakdown: readonly ScoreBreakdownEntry[];
  readonly validationErrors: readonly VerificationValidationError[];
  readonly failureReason?: string;
}
