import {
  Prisma,
  PrismaClient,
  type Assessment as PrismaAssessment,
  type AssessmentFinding as PrismaAssessmentFinding,
  type AuditEvent as PrismaAuditEvent,
  type BlockchainRecord as PrismaBlockchainRecord,
  type CreditBatch as PrismaCreditBatch,
  type CreditLifecycleEvent as PrismaCreditLifecycleEvent,
  type Evidence as PrismaEvidence,
  type IdempotencyRecord as PrismaIdempotencyRecord,
  type Project as PrismaProject,
  type Review as PrismaReview,
  type User as PrismaUser,
} from '@prisma/client';
import type {
  Assessment,
  AssessmentFinding,
  AuditEvent,
  BlockchainRecord,
  CreditBatch,
  CreditLifecycleEvent,
  Evidence,
  IdempotencyRecord,
  Project,
  Review,
  User,
} from '../domain.js';
import type { Store } from '../repository.js';
import {
  fromPrismaBigInt,
  fromPrismaDate,
  fromPrismaJson,
  toOptionalPrismaDate,
  toOptionalPrismaJson,
  toPrismaBigInt,
  toPrismaDate,
  toPrismaJson,
} from './mapping.js';

export class PrismaMap<T> extends Map<string, T> {
  private hydrated = false;

  public constructor(
    private readonly schedule: (value: T) => void,
    private readonly reportPendingAsNonEmpty = false,
  ) {
    super();
  }

  public override set(key: string, value: T): this {
    super.set(key, value);
    this.schedule(value);
    return this;
  }

  public load(entries: ReadonlyArray<readonly [string, T]>): void {
    for (const [key, value] of entries) {
      if (!super.has(key)) super.set(key, value);
    }
    this.hydrated = true;
  }

  public markHydrated(): void {
    this.hydrated = true;
  }

  public override get size(): number {
    if (!this.hydrated && this.reportPendingAsNonEmpty) return 1;
    return super.size;
  }
}

export class PrismaStore implements Store {
  public readonly mode = 'prisma' as const;
  public readonly users: PrismaMap<User>;
  public readonly projects: PrismaMap<Project>;
  public readonly evidence: PrismaMap<Evidence>;
  public readonly assessments: PrismaMap<Assessment>;
  public readonly findings: PrismaMap<AssessmentFinding>;
  public readonly reviews: PrismaMap<Review>;
  public readonly creditBatches: PrismaMap<CreditBatch>;
  public readonly creditEvents: PrismaMap<CreditLifecycleEvent>;
  public readonly blockchainRecords: PrismaMap<BlockchainRecord>;
  public readonly auditEvents: PrismaMap<AuditEvent>;
  public readonly idempotency: PrismaMap<IdempotencyRecord>;
  public readonly ready: Promise<void>;

  private writeQueue: Promise<void> = Promise.resolve();
  private initializationError: unknown;
  private lastWriteError: unknown;

  public constructor(private readonly client: PrismaClient) {
    this.users = new PrismaMap<User>((value) => this.enqueue(() => this.persistUser(value)), true);
    this.projects = new PrismaMap<Project>((value) =>
      this.enqueue(() => this.persistProject(value)),
    );
    this.evidence = new PrismaMap<Evidence>((value) =>
      this.enqueue(() => this.persistEvidence(value)),
    );
    this.assessments = new PrismaMap<Assessment>((value) =>
      this.enqueue(() => this.persistAssessment(value)),
    );
    this.findings = new PrismaMap<AssessmentFinding>((value) =>
      this.enqueue(() => this.persistFinding(value)),
    );
    this.reviews = new PrismaMap<Review>((value) => this.enqueue(() => this.persistReview(value)));
    this.creditBatches = new PrismaMap<CreditBatch>((value) =>
      this.enqueue(() => this.persistCreditBatch(value)),
    );
    this.creditEvents = new PrismaMap<CreditLifecycleEvent>((value) =>
      this.enqueue(() => this.persistCreditEvent(value)),
    );
    this.blockchainRecords = new PrismaMap<BlockchainRecord>((value) =>
      this.enqueue(() => this.persistBlockchainRecord(value)),
    );
    this.auditEvents = new PrismaMap<AuditEvent>((value) =>
      this.enqueue(() => this.persistAuditEvent(value)),
    );
    this.idempotency = new PrismaMap<IdempotencyRecord>((value) =>
      this.enqueue(() => this.persistIdempotency(value)),
    );
    this.ready = this.hydrate();
  }

  public async flush(): Promise<void> {
    await this.ready;
    await this.writeQueue;
    if (this.initializationError) throw this.initializationError;
    if (this.lastWriteError) throw this.lastWriteError;
  }

  public async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      await this.client.$disconnect();
    }
  }

  private enqueue(task: () => Promise<void>): void {
    this.writeQueue = this.writeQueue
      .then(() => this.ready)
      .then(task)
      .catch((error: unknown) => {
        this.lastWriteError ??= error;
      });
  }

  private async hydrate(): Promise<void> {
    try {
      const [
        users,
        projects,
        evidence,
        assessments,
        findings,
        reviews,
        creditBatches,
        creditEvents,
        blockchainRecords,
        auditEvents,
        idempotency,
      ] = await Promise.all([
        this.client.user.findMany(),
        this.client.project.findMany(),
        this.client.evidence.findMany(),
        this.client.assessment.findMany(),
        this.client.assessmentFinding.findMany(),
        this.client.review.findMany(),
        this.client.creditBatch.findMany(),
        this.client.creditLifecycleEvent.findMany(),
        this.client.blockchainRecord.findMany(),
        this.client.auditEvent.findMany(),
        this.client.idempotencyRecord.findMany(),
      ]);
      this.users.load(users.map((item) => [item.id, mapUser(item)]));
      this.projects.load(projects.map((item) => [item.id, mapProject(item)]));
      this.evidence.load(evidence.map((item) => [item.id, mapEvidence(item)]));
      this.assessments.load(assessments.map((item) => [item.id, mapAssessment(item)]));
      this.findings.load(findings.map((item) => [item.id, mapFinding(item)]));
      this.reviews.load(reviews.map((item) => [item.id, mapReview(item)]));
      this.creditBatches.load(creditBatches.map((item) => [item.id, mapCreditBatch(item)]));
      this.creditEvents.load(creditEvents.map((item) => [item.id, mapCreditEvent(item)]));
      this.blockchainRecords.load(
        blockchainRecords.map((item) => [item.id, mapBlockchainRecord(item)]),
      );
      this.auditEvents.load(auditEvents.map((item) => [item.id, mapAuditEvent(item)]));
      this.idempotency.load(
        idempotency.map((item) => [`${item.scope}:${item.key}`, mapIdempotency(item)]),
      );
    } catch (error: unknown) {
      this.initializationError = error;
      this.users.markHydrated();
      this.projects.markHydrated();
      this.evidence.markHydrated();
      this.assessments.markHydrated();
      this.findings.markHydrated();
      this.reviews.markHydrated();
      this.creditBatches.markHydrated();
      this.creditEvents.markHydrated();
      this.blockchainRecords.markHydrated();
      this.auditEvents.markHydrated();
      this.idempotency.markHydrated();
      throw error;
    }
  }

  private async persistUser(value: User): Promise<void> {
    const data = {
      id: value.id,
      email: value.email,
      displayName: value.displayName,
      passwordHash: value.passwordHash,
      role: value.role,
      status: value.status,
      createdAt: toPrismaDate(value.createdAt),
      updatedAt: toPrismaDate(value.updatedAt),
    } satisfies Prisma.UserUncheckedCreateInput;
    await this.client.user.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistProject(value: Project): Promise<void> {
    const data = {
      id: value.id,
      name: value.name,
      slug: value.slug,
      description: value.description ?? null,
      projectType: value.projectType,
      methodology: value.methodology,
      countryOrRegion: value.countryOrRegion ?? null,
      registryName: value.registryName ?? null,
      externalProjectId: value.externalProjectId ?? null,
      externalProjectUrl: value.externalProjectUrl ?? null,
      projectStatus: value.projectStatus,
      dataOrigin: value.dataOrigin,
      isSynthetic: value.isSynthetic,
      createdById: value.createdById,
      createdAt: toPrismaDate(value.createdAt),
      updatedAt: toPrismaDate(value.updatedAt),
    } satisfies Prisma.ProjectUncheckedCreateInput;
    await this.client.project.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistEvidence(value: Evidence): Promise<void> {
    const data = {
      id: value.id,
      projectId: value.projectId,
      evidenceType: value.evidenceType,
      title: value.title,
      description: value.description ?? null,
      originalFilename: value.originalFilename ?? null,
      mediaType: value.mediaType,
      fileSize: toPrismaBigInt(value.fileSize),
      storageKey: value.storageKey ?? null,
      sha256: value.sha256,
      sourceUrl: value.sourceUrl ?? null,
      sourceIdentifier: value.sourceIdentifier ?? null,
      reportingPeriodStart: toOptionalPrismaDate(value.reportingPeriodStart),
      reportingPeriodEnd: toOptionalPrismaDate(value.reportingPeriodEnd),
      structuredData: toOptionalPrismaJson(value.structuredData),
      submittedById: value.submittedById,
      provenanceType: value.provenanceType,
      isPublic: value.isPublic,
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.EvidenceUncheckedCreateInput;
    await this.client.evidence.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistAssessment(value: Assessment): Promise<void> {
    const data = {
      id: value.id,
      projectId: value.projectId,
      assessmentVersion: value.assessmentVersion,
      ruleSetVersion: value.ruleSetVersion,
      riskScore: value.riskScore,
      riskLevel: value.riskLevel,
      assessmentStatus: value.assessmentStatus,
      findingsSummary: toPrismaJson(value.findingsSummary),
      evidenceSnapshot: toPrismaJson(value.evidenceSnapshot),
      assessedAt: new Date(value.assessedAt),
      createdById: value.createdById,
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.AssessmentUncheckedCreateInput;
    await this.client.assessment.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistFinding(value: AssessmentFinding): Promise<void> {
    const data = {
      id: value.id,
      assessmentId: value.assessmentId,
      ruleId: value.ruleId,
      severity: value.severity,
      category: value.category,
      title: value.title,
      explanation: value.explanation,
      affectedEvidenceIds: value.affectedEvidenceIds,
      affectedFields: value.affectedFields,
      observedValues: toOptionalPrismaJson(value.observedValues),
      expectedCondition: value.expectedCondition,
      recommendation: value.recommendation,
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.AssessmentFindingUncheckedCreateInput;
    await this.client.assessmentFinding.upsert({
      where: { id: value.id },
      create: data,
      update: data,
    });
  }

  private async persistReview(value: Review): Promise<void> {
    const data = {
      id: value.id,
      assessmentId: value.assessmentId,
      reviewerId: value.reviewerId,
      decision: value.decision,
      rationale: value.rationale,
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.ReviewUncheckedCreateInput;
    await this.client.review.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistCreditBatch(value: CreditBatch): Promise<void> {
    const data = {
      id: value.id,
      projectId: value.projectId,
      externalRegistryReference: value.externalRegistryReference ?? null,
      batchReference: value.batchReference,
      unit: value.unit,
      totalQuantity: value.totalQuantity,
      issuedQuantity: value.issuedQuantity,
      retiredQuantity: value.retiredQuantity,
      lifecycleStatus: value.lifecycleStatus,
      contractAddress: value.contractAddress ?? null,
      chainId: value.chainId ?? null,
      onChainRecordId: value.onChainRecordId ?? null,
      isSynthetic: value.isSynthetic,
      createdAt: toPrismaDate(value.createdAt),
      updatedAt: toPrismaDate(value.updatedAt),
    } satisfies Prisma.CreditBatchUncheckedCreateInput;
    await this.client.creditBatch.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistCreditEvent(value: CreditLifecycleEvent): Promise<void> {
    const data = {
      id: value.id,
      creditBatchId: value.creditBatchId,
      eventType: value.eventType,
      quantity: value.quantity,
      actorId: value.actorId,
      transactionHash: value.transactionHash ?? null,
      blockNumber: value.blockNumber ?? null,
      idempotencyKey: value.idempotencyKey,
      metadata: toOptionalPrismaJson(value.metadata),
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.CreditLifecycleEventUncheckedCreateInput;
    await this.client.creditLifecycleEvent.upsert({
      where: { id: value.id },
      create: data,
      update: data,
    });
  }

  private async persistBlockchainRecord(value: BlockchainRecord): Promise<void> {
    const data = {
      id: value.id,
      recordType: value.recordType,
      entityId: value.entityId,
      chainId: value.chainId,
      contractAddress: value.contractAddress,
      transactionHash: value.transactionHash ?? null,
      blockNumber: value.blockNumber ?? null,
      recordIdentifier: value.recordIdentifier,
      payloadHash: value.payloadHash,
      status: value.status,
      confirmations: value.confirmations,
      lastError: value.lastError ?? null,
      createdAt: toPrismaDate(value.createdAt),
      updatedAt: toPrismaDate(value.updatedAt),
    } satisfies Prisma.BlockchainRecordUncheckedCreateInput;
    await this.client.blockchainRecord.upsert({
      where: { id: value.id },
      create: data,
      update: data,
    });
  }

  private async persistAuditEvent(value: AuditEvent): Promise<void> {
    const data = {
      id: value.id,
      actorId: value.actorId ?? null,
      action: value.action,
      entityType: value.entityType,
      entityId: value.entityId,
      correlationId: value.correlationId,
      metadata: toPrismaJson(value.metadata),
      createdAt: toPrismaDate(value.createdAt),
    } satisfies Prisma.AuditEventUncheckedCreateInput;
    await this.client.auditEvent.upsert({ where: { id: value.id }, create: data, update: data });
  }

  private async persistIdempotency(value: IdempotencyRecord): Promise<void> {
    const data = {
      scope: value.scope,
      key: value.key,
      requestHash: value.requestHash,
      responseStatus: value.responseStatus,
      responseBody: toPrismaJson(value.responseBody),
      createdAt: toPrismaDate(value.createdAt),
      expiresAt: new Date(value.expiresAt),
    } satisfies Prisma.IdempotencyRecordCreateInput;
    await this.client.idempotencyRecord.upsert({
      where: { scope_key: { scope: value.scope, key: value.key } },
      create: data,
      update: data,
    });
  }
}

export function createPrismaStore(databaseUrl: string, client?: PrismaClient): PrismaStore {
  return new PrismaStore(client ?? new PrismaClient({ datasources: { db: { url: databaseUrl } } }));
}

function mapUser(value: PrismaUser): User {
  return {
    id: value.id,
    email: value.email,
    displayName: value.displayName,
    passwordHash: value.passwordHash,
    role: value.role,
    status: value.status,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapProject(value: PrismaProject): Project {
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description: value.description ?? undefined,
    projectType: value.projectType,
    methodology: value.methodology,
    countryOrRegion: value.countryOrRegion ?? undefined,
    registryName: value.registryName ?? undefined,
    externalProjectId: value.externalProjectId ?? undefined,
    externalProjectUrl: value.externalProjectUrl ?? undefined,
    projectStatus: value.projectStatus,
    dataOrigin: value.dataOrigin,
    isSynthetic: value.isSynthetic,
    createdById: value.createdById,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapEvidence(value: PrismaEvidence): Evidence {
  return {
    id: value.id,
    projectId: value.projectId,
    evidenceType: value.evidenceType,
    title: value.title,
    description: value.description ?? undefined,
    originalFilename: value.originalFilename ?? undefined,
    mediaType: value.mediaType,
    fileSize: Number(value.fileSize),
    storageKey: value.storageKey ?? undefined,
    sha256: value.sha256,
    sourceUrl: value.sourceUrl ?? undefined,
    sourceIdentifier: value.sourceIdentifier ?? undefined,
    reportingPeriodStart: fromPrismaDate(value.reportingPeriodStart),
    reportingPeriodEnd: fromPrismaDate(value.reportingPeriodEnd),
    structuredData: fromPrismaJson(value.structuredData),
    submittedById: value.submittedById,
    provenanceType: value.provenanceType,
    createdAt: value.createdAt.toISOString(),
    isPublic: value.isPublic,
  };
}

function mapAssessment(value: PrismaAssessment): Assessment {
  return {
    id: value.id,
    projectId: value.projectId,
    assessmentVersion: value.assessmentVersion,
    ruleSetVersion: value.ruleSetVersion,
    riskScore: value.riskScore,
    riskLevel: value.riskLevel,
    assessmentStatus: value.assessmentStatus,
    findingsSummary: fromPrismaJson(value.findingsSummary) as Record<string, unknown>,
    evidenceSnapshot: fromPrismaJson(value.evidenceSnapshot),
    assessedAt: value.assessedAt.toISOString(),
    createdById: value.createdById,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapFinding(value: PrismaAssessmentFinding): AssessmentFinding {
  return {
    id: value.id,
    assessmentId: value.assessmentId,
    ruleId: value.ruleId,
    severity: value.severity,
    category: value.category,
    title: value.title,
    explanation: value.explanation,
    affectedEvidenceIds: [...value.affectedEvidenceIds],
    affectedFields: [...value.affectedFields],
    observedValues: fromPrismaJson(value.observedValues),
    expectedCondition: value.expectedCondition,
    recommendation: value.recommendation,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapReview(value: PrismaReview): Review {
  return {
    id: value.id,
    assessmentId: value.assessmentId,
    reviewerId: value.reviewerId,
    decision: value.decision,
    rationale: value.rationale,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapCreditBatch(value: PrismaCreditBatch): CreditBatch {
  return {
    id: value.id,
    projectId: value.projectId,
    externalRegistryReference: value.externalRegistryReference ?? undefined,
    batchReference: value.batchReference,
    unit: value.unit,
    totalQuantity: value.totalQuantity,
    issuedQuantity: value.issuedQuantity,
    retiredQuantity: value.retiredQuantity,
    lifecycleStatus: value.lifecycleStatus,
    contractAddress: value.contractAddress ?? undefined,
    chainId: value.chainId ?? undefined,
    onChainRecordId: value.onChainRecordId ?? undefined,
    isSynthetic: value.isSynthetic,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapCreditEvent(value: PrismaCreditLifecycleEvent): CreditLifecycleEvent {
  return {
    id: value.id,
    creditBatchId: value.creditBatchId,
    eventType: value.eventType,
    quantity: value.quantity,
    actorId: value.actorId,
    transactionHash: value.transactionHash ?? undefined,
    blockNumber: fromPrismaBigInt(value.blockNumber),
    idempotencyKey: value.idempotencyKey,
    metadata: fromPrismaJson(value.metadata),
    createdAt: value.createdAt.toISOString(),
  };
}

function mapBlockchainRecord(value: PrismaBlockchainRecord): BlockchainRecord {
  return {
    id: value.id,
    recordType: value.recordType,
    entityId: value.entityId,
    chainId: value.chainId,
    contractAddress: value.contractAddress,
    transactionHash: value.transactionHash ?? undefined,
    blockNumber: fromPrismaBigInt(value.blockNumber),
    recordIdentifier: value.recordIdentifier,
    payloadHash: value.payloadHash,
    status: value.status,
    confirmations: value.confirmations,
    lastError: value.lastError ?? undefined,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapAuditEvent(value: PrismaAuditEvent): AuditEvent {
  return {
    id: value.id,
    actorId: value.actorId ?? undefined,
    action: value.action,
    entityType: value.entityType,
    entityId: value.entityId,
    correlationId: value.correlationId,
    metadata: fromPrismaJson(value.metadata) as Record<string, unknown>,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapIdempotency(value: PrismaIdempotencyRecord): IdempotencyRecord {
  return {
    scope: value.scope,
    key: value.key,
    requestHash: value.requestHash,
    responseStatus: value.responseStatus,
    responseBody: fromPrismaJson(value.responseBody),
    createdAt: value.createdAt.toISOString(),
    expiresAt: value.expiresAt.toISOString(),
  };
}
