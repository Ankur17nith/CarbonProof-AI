import { createHash } from 'node:crypto';
import type { Hex } from 'viem';
import type { AuthUser } from './auth.js';
import type { AppConfig } from './config.js';
import {
  createBlockchainAdapter,
  type BlockchainAdapter,
  type ConfirmedTransaction,
  type SubmittedTransaction,
} from './blockchain/index.js';
import {
  type Assessment,
  type AssessmentFinding,
  type AuditEvent,
  type BlockchainRecord,
  type CreditBatch,
  type CreditLifecycleEvent,
  type Evidence,
  type IdempotencyRecord,
  hashJson,
  id,
  type Project,
  now,
  type Review,
  serialize,
  stableJson,
} from './domain.js';
import { type VerificationResult, verify } from './verification/index.js';
import type { Store } from './repository.js';
import type { StorageAdapter } from './storage.js';
import { sha256 } from './storage.js';

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  projectType: string;
  methodology: string;
  countryOrRegion?: string;
  registryName?: string;
  externalProjectId?: string;
  externalProjectUrl?: string;
  projectStatus?: Project['projectStatus'];
  dataOrigin?: Project['dataOrigin'];
  isSynthetic?: boolean;
}

export interface EvidenceInput {
  evidenceType: string;
  title: string;
  description?: string;
  originalFilename?: string;
  mediaType: string;
  sourceUrl?: string;
  sourceIdentifier?: string;
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
  structuredData?: unknown;
  provenanceType?: Evidence['provenanceType'];
  isPublic?: boolean;
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
  blockNumber?: bigint;
  confirmations?: number;
  error?: string;
}

const EVIDENCE_BLOCKCHAIN_RECORD = 'EVIDENCE_REGISTRATION';
const ISSUE_BLOCKCHAIN_RECORD = 'CREDIT_ISSUANCE';
const RETIRE_BLOCKCHAIN_RECORD = 'CREDIT_RETIREMENT';

export class AppService {
  public constructor(
    private readonly store: Store,
    private readonly storage: StorageAdapter,
    private readonly config: AppConfig,
    private readonly blockchain: BlockchainAdapter = createBlockchainAdapter(),
  ) {}

  public audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    correlationId: string,
  ): AuditEvent {
    const event: AuditEvent = {
      id: id(),
      actorId,
      action,
      entityType,
      entityId,
      correlationId,
      metadata: redactMetadata(metadata),
      createdAt: now(),
    };
    this.store.auditEvents.set(event.id, event);
    return event;
  }

  public createProject(input: CreateProjectInput, actor: AuthUser, correlationId: string): Project {
    const slug = input.slug.trim().toLowerCase();
    if ([...this.store.projects.values()].some((project) => project.slug === slug)) {
      throw conflict('PROJECT_SLUG_EXISTS', 'A project with this slug already exists.');
    }
    if (
      input.registryName &&
      input.externalProjectId &&
      [...this.store.projects.values()].some(
        (project) =>
          project.registryName === input.registryName &&
          project.externalProjectId === input.externalProjectId,
      )
    ) {
      throw conflict(
        'EXTERNAL_PROJECT_EXISTS',
        'This registry and external project reference is already registered.',
      );
    }
    const timestamp = now();
    const project: Project = {
      id: id(),
      name: input.name.trim(),
      slug,
      description: input.description?.trim(),
      projectType: input.projectType.trim(),
      methodology: input.methodology.trim(),
      countryOrRegion: input.countryOrRegion?.trim(),
      registryName: input.registryName?.trim(),
      externalProjectId: input.externalProjectId?.trim(),
      externalProjectUrl: input.externalProjectUrl,
      projectStatus: input.projectStatus ?? 'DRAFT',
      dataOrigin: input.dataOrigin ?? 'USER_SUBMITTED',
      isSynthetic: input.isSynthetic ?? false,
      createdById: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.projects.set(project.id, project);
    this.audit(
      actor.id,
      'PROJECT_CREATED',
      'Project',
      project.id,
      { slug: project.slug, isSynthetic: project.isSynthetic },
      correlationId,
    );
    return project;
  }

  public listProjects(query: {
    page: number;
    pageSize: number;
    search?: string;
    status?: Project['projectStatus'];
    createdById?: string;
    sort: 'createdAt' | 'name';
  }): { items: Project[]; page: number; pageSize: number; total: number; totalPages: number } {
    let items = [...this.store.projects.values()];
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter((project) =>
        `${project.name} ${project.slug} ${project.externalProjectId ?? ''}`
          .toLowerCase()
          .includes(term),
      );
    }
    if (query.status) items = items.filter((project) => project.projectStatus === query.status);
    if (query.createdById)
      items = items.filter((project) => project.createdById === query.createdById);
    items.sort((left, right) =>
      query.sort === 'name'
        ? left.name.localeCompare(right.name)
        : right.createdAt.localeCompare(left.createdAt),
    );
    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  public getProject(projectId: string): Project {
    const project = this.store.projects.get(projectId);
    if (!project) throw notFound('PROJECT_NOT_FOUND', 'Project was not found.');
    return project;
  }

  public updateProject(
    projectId: string,
    input: Partial<CreateProjectInput>,
    actor: AuthUser,
    correlationId: string,
  ): Project {
    const project = this.getProject(projectId);
    if (actor.role !== 'ADMIN' && project.createdById !== actor.id) throw forbidden();
    const next = {
      ...project,
      ...input,
      slug: input.slug?.trim().toLowerCase() ?? project.slug,
      updatedAt: now(),
    };
    if (
      [...this.store.projects.values()].some(
        (item) => item.id !== projectId && item.slug === next.slug,
      )
    )
      throw conflict('PROJECT_SLUG_EXISTS', 'A project with this slug already exists.');
    this.store.projects.set(projectId, next);
    this.audit(
      actor.id,
      'PROJECT_UPDATED',
      'Project',
      projectId,
      { fields: Object.keys(input) },
      correlationId,
    );
    return next;
  }

  public getProjectEvidence(projectId: string): Evidence[] {
    this.getProject(projectId);
    return [...this.store.evidence.values()]
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async addEvidence(
    projectId: string,
    input: EvidenceInput,
    bytes: Buffer,
    actor: AuthUser,
    correlationId: string,
  ): Promise<Evidence> {
    this.getProject(projectId);
    if (bytes.length > this.config.MAX_UPLOAD_SIZE)
      throw Object.assign(new Error('Evidence exceeds the configured upload size.'), {
        statusCode: 413,
        code: 'UPLOAD_TOO_LARGE',
      });
    if (input.sourceUrl) {
      try {
        new URL(input.sourceUrl);
      } catch {
        throw badRequest('INVALID_SOURCE_URL', 'sourceUrl must be a valid URL.');
      }
    }
    const digest = sha256(bytes);
    if (
      [...this.store.evidence.values()].some(
        (item) => item.projectId === projectId && item.sha256 === digest,
      )
    )
      throw conflict(
        'DUPLICATE_EVIDENCE',
        'Evidence with the same SHA-256 hash already exists for this project.',
      );
    const evidenceId = id();
    const key = `${projectId}/${evidenceId}`;
    await this.storage.put(key, bytes);
    let evidence: Evidence;
    try {
      evidence = {
        id: evidenceId,
        projectId,
        evidenceType: input.evidenceType.trim(),
        title: input.title.trim(),
        description: input.description?.trim(),
        originalFilename: input.originalFilename,
        mediaType: input.mediaType,
        fileSize: bytes.length,
        storageKey: key,
        sha256: digest,
        sourceUrl: input.sourceUrl,
        sourceIdentifier: input.sourceIdentifier,
        reportingPeriodStart: input.reportingPeriodStart,
        reportingPeriodEnd: input.reportingPeriodEnd,
        structuredData: input.structuredData,
        submittedById: actor.id,
        provenanceType: input.provenanceType ?? 'USER_ASSERTED',
        createdAt: now(),
        isPublic: input.isPublic ?? false,
      };
      this.store.evidence.set(evidence.id, evidence);
      this.audit(
        actor.id,
        'EVIDENCE_SUBMITTED',
        'Evidence',
        evidence.id,
        { projectId, sha256: digest, fileSize: evidence.fileSize, mediaType: evidence.mediaType },
        correlationId,
      );
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
    await this.registerEvidenceOnBlockchain(evidence);
    return evidence;
  }

  public getEvidence(evidenceId: string): Evidence {
    const evidence = this.store.evidence.get(evidenceId);
    if (!evidence) throw notFound('EVIDENCE_NOT_FOUND', 'Evidence was not found.');
    return evidence;
  }

  public async verifyEvidenceIntegrity(
    evidenceId: string,
    actor: AuthUser | undefined,
    correlationId: string,
  ): Promise<{
    status: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE';
    expectedHash: string;
    actualHash?: string;
  }> {
    const evidence = this.getEvidence(evidenceId);
    if (!evidence.storageKey) return { status: 'UNAVAILABLE', expectedHash: evidence.sha256 };
    const bytes = await this.storage.read(evidence.storageKey);
    if (!bytes) return { status: 'UNAVAILABLE', expectedHash: evidence.sha256 };
    const actualHash = sha256(bytes);
    const status = actualHash === evidence.sha256 ? 'MATCH' : 'MISMATCH';
    this.audit(
      actor?.id,
      'EVIDENCE_INTEGRITY_VERIFIED',
      'Evidence',
      evidenceId,
      { status, expectedHash: evidence.sha256, actualHash },
      correlationId,
    );
    return { status, expectedHash: evidence.sha256, actualHash };
  }

  public async readEvidence(evidenceId: string): Promise<Buffer> {
    const evidence = this.getEvidence(evidenceId);
    if (!evidence.storageKey)
      throw Object.assign(new Error('Evidence content is unavailable.'), {
        statusCode: 503,
        code: 'EVIDENCE_UNAVAILABLE',
      });
    const bytes = await this.storage.read(evidence.storageKey);
    if (!bytes)
      throw Object.assign(new Error('Evidence content is unavailable.'), {
        statusCode: 503,
        code: 'EVIDENCE_UNAVAILABLE',
      });
    return bytes;
  }

  public listAssessments(projectId?: string): Assessment[] {
    return [...this.store.assessments.values()]
      .filter((item) => !projectId || item.projectId === projectId)
      .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt));
  }

  public createAssessment(
    projectId: string,
    input: { evidenceIds?: string[]; verification?: Record<string, unknown> },
    actor: AuthUser,
    correlationId: string,
  ): { assessment: Assessment; findings: AssessmentFinding[]; result: VerificationResult } {
    const project = this.getProject(projectId);
    const evidence = this.getProjectEvidence(projectId).filter(
      (item) => !input.evidenceIds || input.evidenceIds.includes(item.id),
    );
    if (input.evidenceIds?.some((evidenceId) => !this.store.evidence.has(evidenceId)))
      throw badRequest(
        'INVALID_EVIDENCE_REFERENCE',
        'Every evidenceId must refer to an existing evidence record.',
      );
    const verificationProject = {
      ...project,
      ...(input.verification?.project as Record<string, unknown> | undefined),
    } as never;
    const result = verify({
      project: verificationProject,
      evidence: evidence.map((item) => ({
        ...item,
        sha256: item.sha256,
        provenance: item.provenanceType,
      })),
      config: input.verification?.config as never,
    });
    const timestamp = now();
    const assessment: Assessment = {
      id: id(),
      projectId,
      assessmentVersion: '1.0.0',
      ruleSetVersion: result.ruleSetVersion,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      assessmentStatus: result.status,
      findingsSummary: {
        findingCount: result.findings.length,
        score: result.score,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        scoreBreakdown: result.scoreBreakdown,
        validationErrors: result.validationErrors,
      },
      evidenceSnapshot: serialize(
        evidence.map((item) => ({
          id: item.id,
          sha256: item.sha256,
          evidenceType: item.evidenceType,
          reportingPeriodStart: item.reportingPeriodStart,
          reportingPeriodEnd: item.reportingPeriodEnd,
          structuredData: item.structuredData,
        })),
      ),
      assessedAt: timestamp,
      createdById: actor.id,
      createdAt: timestamp,
    };
    this.store.assessments.set(assessment.id, assessment);
    const findings = result.findings.map((finding) => {
      const item: AssessmentFinding = {
        id: finding.id,
        assessmentId: assessment.id,
        ruleId: finding.ruleId,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        explanation: finding.explanation,
        affectedEvidenceIds: [...finding.affectedEvidenceIds],
        affectedFields: [...finding.affectedFields],
        observedValues: finding.observedValues,
        expectedCondition: finding.expectedCondition,
        recommendation: finding.recommendation,
        createdAt: timestamp,
      };
      this.store.findings.set(item.id, item);
      return item;
    });
    this.audit(
      actor.id,
      'ASSESSMENT_CREATED',
      'Assessment',
      assessment.id,
      {
        projectId,
        assessmentStatus: assessment.assessmentStatus,
        riskScore: assessment.riskScore,
        ruleSetVersion: assessment.ruleSetVersion,
      },
      correlationId,
    );
    return { assessment, findings, result };
  }

  public getAssessment(assessmentId: string): Assessment {
    const assessment = this.store.assessments.get(assessmentId);
    if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Assessment was not found.');
    return assessment;
  }

  public getFindings(assessmentId: string): AssessmentFinding[] {
    this.getAssessment(assessmentId);
    return [...this.store.findings.values()].filter((item) => item.assessmentId === assessmentId);
  }

  public createReview(
    assessmentId: string,
    decision: Review['decision'],
    rationale: string,
    reviewer: AuthUser,
    correlationId: string,
  ): Review {
    const assessment = this.getAssessment(assessmentId);
    if (assessment.createdById === reviewer.id)
      throw forbidden('Separation of duties prevents reviewing your own assessment.');
    const review: Review = {
      id: id(),
      assessmentId,
      reviewerId: reviewer.id,
      decision,
      rationale: rationale.trim(),
      createdAt: now(),
    };
    this.store.reviews.set(review.id, review);
    this.audit(
      reviewer.id,
      'REVIEW_DECISION_RECORDED',
      'Review',
      review.id,
      { assessmentId, decision },
      correlationId,
    );
    return review;
  }

  public getReviews(assessmentId: string): Review[] {
    this.getAssessment(assessmentId);
    return [...this.store.reviews.values()]
      .filter((item) => item.assessmentId === assessmentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public createCreditBatch(
    input: {
      projectId: string;
      externalRegistryReference?: string;
      batchReference: string;
      unit: string;
      totalQuantity: string;
      isSynthetic?: boolean;
    },
    actor: AuthUser,
    correlationId: string,
  ): CreditBatch {
    this.getProject(input.projectId);
    let total: bigint;
    try {
      total = BigInt(input.totalQuantity);
    } catch {
      throw badRequest('INVALID_QUANTITY', 'Quantity must be an integer string.');
    }
    if (total <= 0n) throw badRequest('INVALID_QUANTITY', 'Quantity must be greater than zero.');
    if (
      [...this.store.creditBatches.values()].some(
        (batch) =>
          batch.projectId === input.projectId && batch.batchReference === input.batchReference,
      )
    )
      throw conflict('BATCH_EXISTS', 'This batch reference already exists for the project.');
    const timestamp = now();
    const batch: CreditBatch = {
      id: id(),
      projectId: input.projectId,
      externalRegistryReference: input.externalRegistryReference,
      batchReference: input.batchReference.trim(),
      unit: input.unit.trim(),
      totalQuantity: total,
      issuedQuantity: 0n,
      retiredQuantity: 0n,
      lifecycleStatus: 'REGISTERED',
      isSynthetic: input.isSynthetic ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.creditBatches.set(batch.id, batch);
    this.audit(
      actor.id,
      'CREDIT_BATCH_CREATED',
      'CreditBatch',
      batch.id,
      {
        projectId: batch.projectId,
        batchReference: batch.batchReference,
        isSynthetic: batch.isSynthetic,
      },
      correlationId,
    );
    return batch;
  }

  public listCreditBatches(projectId?: string): CreditBatch[] {
    return [...this.store.creditBatches.values()]
      .filter((item) => !projectId || item.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  public getCreditBatch(batchId: string): CreditBatch {
    const batch = this.store.creditBatches.get(batchId);
    if (!batch) throw notFound('CREDIT_BATCH_NOT_FOUND', 'Credit batch was not found.');
    return batch;
  }

  public async mutateCredit(
    batchId: string,
    type: 'ISSUED' | 'RETIRED',
    quantityInput: string,
    idempotencyKey: string,
    actor: AuthUser,
    correlationId: string,
  ): Promise<{ batch: CreditBatch; event: CreditLifecycleEvent; replayed: boolean }> {
    const scope = `credit:${batchId}:${type}`;
    const requestHash = createHash('sha256')
      .update(stableJson({ batchId, type, quantityInput }))
      .digest('hex');
    const existing = this.store.idempotency.get(`${scope}:${idempotencyKey}`);
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw conflict(
          'IDEMPOTENCY_KEY_REUSED',
          'The idempotency key was already used with a different request.',
        );
      const event = [...this.store.creditEvents.values()].find(
        (item) =>
          item.creditBatchId === batchId &&
          item.eventType === type &&
          item.idempotencyKey === idempotencyKey,
      );
      if (!event)
        throw conflict('IDEMPOTENCY_STATE_MISSING', 'The idempotency record cannot be reconciled.');
      return { batch: this.getCreditBatch(batchId), event, replayed: true };
    }
    let quantity: bigint;
    try {
      quantity = BigInt(quantityInput);
    } catch {
      throw badRequest('INVALID_QUANTITY', 'Quantity must be an integer string.');
    }
    if (quantity <= 0n) throw badRequest('INVALID_QUANTITY', 'Quantity must be greater than zero.');
    const batch = this.getCreditBatch(batchId);
    const available = batch.totalQuantity - batch.issuedQuantity;
    const unretired = batch.issuedQuantity - batch.retiredQuantity;
    if (type === 'ISSUED' && quantity > available)
      throw conflict(
        'INSUFFICIENT_UNISSUED_SUPPLY',
        'The requested issuance exceeds the batch total.',
      );
    if (type === 'RETIRED' && quantity > unretired)
      throw conflict(
        'INSUFFICIENT_AVAILABLE_CREDITS',
        'The requested retirement exceeds the available issued quantity.',
      );
    if (type === 'ISSUED') batch.issuedQuantity += quantity;
    else batch.retiredQuantity += quantity;
    batch.lifecycleStatus =
      batch.retiredQuantity === batch.totalQuantity
        ? 'FULLY_RETIRED'
        : batch.issuedQuantity === batch.totalQuantity && batch.retiredQuantity === 0n
          ? 'ISSUED'
          : batch.retiredQuantity > 0n
            ? 'PARTIALLY_RETIRED'
            : batch.issuedQuantity > 0n
              ? 'PARTIALLY_ISSUED'
              : 'REGISTERED';
    batch.updatedAt = now();
    this.store.creditBatches.set(batch.id, batch);
    const blockchainOperation = this.blockchain.enabled
      ? this.createCreditBlockchainOperation(batch, type, quantity, idempotencyKey)
      : undefined;
    if (blockchainOperation) {
      this.store.blockchainRecords.set(blockchainOperation.record.id, blockchainOperation.record);
      batch.contractAddress = blockchainOperation.record.contractAddress;
      batch.chainId = blockchainOperation.record.chainId;
      batch.onChainRecordId = blockchainOperation.operationId;
      this.store.creditBatches.set(batch.id, batch);
    }
    const event: CreditLifecycleEvent = {
      id: id(),
      creditBatchId: batchId,
      eventType: type,
      quantity,
      actorId: actor.id,
      idempotencyKey,
      metadata: blockchainOperation
        ? this.blockchainMetadataForRecord(blockchainOperation.record)
        : { blockchain: 'disabled' },
      createdAt: now(),
    };
    this.store.creditEvents.set(event.id, event);
    const record: IdempotencyRecord = {
      scope,
      key: idempotencyKey,
      requestHash,
      responseStatus: 200,
      responseBody: serialize({ batch, event }),
      createdAt: now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    this.store.idempotency.set(`${scope}:${idempotencyKey}`, record);
    this.audit(
      actor.id,
      type === 'ISSUED' ? 'CREDIT_ISSUED' : 'CREDIT_RETIRED',
      'CreditBatch',
      batchId,
      { quantity: quantity.toString(), idempotencyKey },
      correlationId,
    );
    if (blockchainOperation) {
      await this.submitCreditBlockchainOperation(blockchainOperation, event);
    }
    return { batch, event, replayed: false };
  }

  public blockchainMetadata(
    recordType: string | readonly string[],
    entityId: string,
  ): BlockchainWorkflowMetadata {
    if (!this.blockchain.enabled) return { enabled: false, status: 'disabled' };
    const recordTypes = typeof recordType === 'string' ? [recordType] : recordType;
    const records = [...this.store.blockchainRecords.values()]
      .filter((record) => recordTypes.includes(record.recordType) && record.entityId === entityId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const record = records[0];
    return record
      ? this.blockchainMetadataForRecord(record)
      : { enabled: true, status: 'not_attempted' };
  }

  public getCreditEvents(batchId: string): CreditLifecycleEvent[] {
    this.getCreditBatch(batchId);
    return [...this.store.creditEvents.values()]
      .filter((item) => item.creditBatchId === batchId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  public listAudit(query: {
    page: number;
    pageSize: number;
    entityType?: string;
    entityId?: string;
  }): { items: AuditEvent[]; page: number; pageSize: number; total: number; totalPages: number } {
    let items = [...this.store.auditEvents.values()];
    if (query.entityType) items = items.filter((item) => item.entityType === query.entityType);
    if (query.entityId) items = items.filter((item) => item.entityId === query.entityId);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  public publicProject(projectId: string): Record<string, unknown> {
    const project = this.getProject(projectId);
    const latest = this.listAssessments(projectId)[0];
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      projectType: project.projectType,
      methodology: project.methodology,
      countryOrRegion: project.countryOrRegion,
      registryName: project.registryName,
      externalProjectId: project.externalProjectId,
      externalProjectUrl: project.externalProjectUrl,
      projectStatus: project.projectStatus,
      dataOrigin: project.dataOrigin,
      isSynthetic: project.isSynthetic,
      evidence: this.getProjectEvidence(projectId)
        .filter((item) => item.isPublic)
        .map((item) => ({
          id: item.id,
          evidenceType: item.evidenceType,
          title: item.title,
          sha256: item.sha256,
          sourceIdentifier: item.sourceIdentifier,
          provenanceType: item.provenanceType,
          createdAt: item.createdAt,
          blockchain: this.blockchainMetadata(EVIDENCE_BLOCKCHAIN_RECORD, item.id),
        })),
      latestAssessment: latest
        ? {
            id: latest.id,
            riskScore: latest.riskScore,
            riskLevel: latest.riskLevel,
            assessmentStatus: latest.assessmentStatus,
            ruleSetVersion: latest.ruleSetVersion,
            assessedAt: latest.assessedAt,
          }
        : null,
    };
  }

  public storeSnapshot(): Store {
    return this.store;
  }

  private async registerEvidenceOnBlockchain(evidence: Evidence): Promise<void> {
    if (!this.blockchain.enabled) return;
    const evidenceId = bytes32Id('evidence', evidence.id);
    const payload = {
      evidenceId,
      uri: evidence.sourceUrl ?? evidence.storageKey ?? evidence.id,
      contentHash: bytes32Hash(evidence.sha256),
    };
    const record = this.createPendingBlockchainRecord(
      EVIDENCE_BLOCKCHAIN_RECORD,
      evidence.id,
      evidenceId,
      payload,
    );
    this.store.blockchainRecords.set(record.id, record);
    try {
      const submission = await this.blockchain.registerEvidence(payload);
      this.markBlockchainSubmission(record, submission);
      const confirmation = await this.blockchain.confirmTransaction(submission.hash);
      this.markBlockchainConfirmation(record, confirmation);
    } catch (error) {
      this.markBlockchainFailure(record, error);
    }
  }

  private createCreditBlockchainOperation(
    batch: CreditBatch,
    type: 'ISSUED' | 'RETIRED',
    quantity: bigint,
    idempotencyKey: string,
  ): {
    record: BlockchainRecord;
    operationId: Hex;
    projectId: Hex;
    evidenceId: Hex;
  } {
    const operationId = bytes32Id('credit-operation', `${batch.id}:${type}:${idempotencyKey}`);
    const projectId = bytes32Id('project', batch.projectId);
    const evidence = this.getProjectEvidence(batch.projectId)[0];
    const evidenceId = evidence
      ? bytes32Id('evidence', evidence.id)
      : bytes32Id('batch-evidence', batch.id);
    const recordType = type === 'ISSUED' ? ISSUE_BLOCKCHAIN_RECORD : RETIRE_BLOCKCHAIN_RECORD;
    const record = this.createPendingBlockchainRecord(recordType, batch.id, operationId, {
      operationId,
      projectId,
      quantity: quantity.toString(),
      evidenceId: type === 'ISSUED' ? evidenceId : undefined,
      idempotencyKey,
    });
    return { record, operationId, projectId, evidenceId };
  }

  private async submitCreditBlockchainOperation(
    operation: {
      record: BlockchainRecord;
      operationId: Hex;
      projectId: Hex;
      evidenceId: Hex;
    },
    event: CreditLifecycleEvent,
  ): Promise<void> {
    try {
      const submission =
        event.eventType === 'ISSUED'
          ? await this.blockchain.issueCredits({
              operationId: operation.operationId,
              projectId: operation.projectId,
              quantity: event.quantity,
              evidenceId: operation.evidenceId,
            })
          : await this.blockchain.retireCredits({
              operationId: operation.operationId,
              projectId: operation.projectId,
              quantity: event.quantity,
            });
      this.markBlockchainSubmission(operation.record, submission);
      this.updateCreditEventBlockchain(event, operation.record);
      const confirmation = await this.blockchain.confirmTransaction(submission.hash);
      this.markBlockchainConfirmation(operation.record, confirmation);
      this.updateCreditEventBlockchain(event, operation.record);
    } catch (error) {
      this.markBlockchainFailure(operation.record, error);
      this.updateCreditEventBlockchain(event, operation.record);
    }
  }

  private createPendingBlockchainRecord(
    recordType: string,
    entityId: string,
    recordIdentifier: string,
    payload: unknown,
  ): BlockchainRecord {
    const timestamp = now();
    return {
      id: id(),
      recordType,
      entityId,
      chainId: this.blockchain.chainId ?? this.config.BLOCKCHAIN_CHAIN_ID,
      contractAddress:
        this.blockchain.contractAddress ??
        this.config.BLOCKCHAIN_CONTRACT_ADDRESS ??
        'unconfigured',
      recordIdentifier,
      payloadHash: hashJson(payload),
      status: 'PENDING',
      confirmations: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private markBlockchainSubmission(
    record: BlockchainRecord,
    submission: SubmittedTransaction,
  ): void {
    record.transactionHash = submission.hash;
    record.chainId = submission.chainId;
    record.contractAddress = submission.contractAddress;
    record.updatedAt = now();
    this.store.blockchainRecords.set(record.id, record);
  }

  private markBlockchainConfirmation(
    record: BlockchainRecord,
    confirmation: ConfirmedTransaction,
  ): void {
    record.status = 'CONFIRMED';
    record.transactionHash = confirmation.hash;
    record.blockNumber = confirmation.blockNumber;
    record.confirmations = confirmation.confirmations;
    record.chainId = confirmation.chainId;
    record.contractAddress = confirmation.contractAddress;
    record.lastError = undefined;
    record.updatedAt = now();
    this.store.blockchainRecords.set(record.id, record);
  }

  private markBlockchainFailure(record: BlockchainRecord, error: unknown): void {
    record.status = 'FAILED';
    record.lastError = errorMessage(error);
    record.updatedAt = now();
    this.store.blockchainRecords.set(record.id, record);
  }

  private updateCreditEventBlockchain(event: CreditLifecycleEvent, record: BlockchainRecord): void {
    event.metadata = this.blockchainMetadataForRecord(record);
    if (record.transactionHash) event.transactionHash = record.transactionHash;
    if (record.blockNumber !== undefined) event.blockNumber = record.blockNumber;
    this.store.creditEvents.set(event.id, event);
  }

  private blockchainMetadataForRecord(record: BlockchainRecord): BlockchainWorkflowMetadata {
    return {
      enabled: true,
      status: record.status.toLowerCase() as Exclude<
        BlockchainWorkflowStatus,
        'disabled' | 'not_attempted'
      >,
      recordId: record.id,
      recordIdentifier: record.recordIdentifier,
      transactionHash: record.transactionHash,
      blockNumber: record.blockNumber,
      confirmations: record.confirmations,
      error: record.lastError,
    };
  }
}

function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const secretKeys = new Set([
    'password',
    'passwordHash',
    'token',
    'authorization',
    'privateKey',
    'private_key',
  ]);
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !secretKeys.has(key))
      .map(([key, value]) => [
        key,
        typeof value === 'string' && value.length > 2048 ? `${value.slice(0, 2048)}…` : value,
      ]),
  );
}

function error(
  code: string,
  message: string,
  statusCode: number,
): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(message), { code, statusCode });
}
function badRequest(code: string, message: string) {
  return error(code, message, 400);
}
function conflict(code: string, message: string) {
  return error(code, message, 409);
}
function notFound(code: string, message: string) {
  return error(code, message, 404);
}
function forbidden(message = 'You do not have permission for this action.') {
  return error('FORBIDDEN', message, 403);
}

function bytes32Id(namespace: string, value: string): Hex {
  return `0x${createHash('sha256').update(`${namespace}:${value}`).digest('hex')}` as Hex;
}

function bytes32Hash(value: string): Hex {
  return `0x${value.replace(/^0x/, '')}` as Hex;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
