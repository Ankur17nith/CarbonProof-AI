-- Generated with: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."UserRole" AS ENUM ('PUBLIC', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN');
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "public"."ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED_INTERNAL', 'REJECTED');
CREATE TYPE "public"."DataOrigin" AS ENUM ('USER_SUBMITTED', 'REGISTRY_REFERENCE', 'SYNTHETIC_DEMO');
CREATE TYPE "public"."ProvenanceType" AS ENUM ('PRIMARY_SOURCE', 'REGISTRY_REFERENCE', 'USER_ASSERTED', 'SYNTHETIC');
CREATE TYPE "public"."RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "public"."AssessmentStatus" AS ENUM ('VALIDATION_ERROR', 'COMPLETED_WITH_FINDINGS', 'COMPLETED_NO_FINDINGS', 'FAILED');
CREATE TYPE "public"."FindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "public"."ReviewDecision" AS ENUM ('APPROVED_FOR_INTERNAL_REVIEW', 'REJECTED', 'NEEDS_MORE_EVIDENCE');
CREATE TYPE "public"."CreditLifecycleStatus" AS ENUM ('REGISTERED', 'PARTIALLY_ISSUED', 'ISSUED', 'PARTIALLY_RETIRED', 'FULLY_RETIRED');
CREATE TYPE "public"."CreditEventType" AS ENUM ('ISSUED', 'RETIRED');
CREATE TYPE "public"."BlockchainRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "projectType" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "countryOrRegion" TEXT,
    "registryName" TEXT,
    "externalProjectId" TEXT,
    "externalProjectUrl" TEXT,
    "projectStatus" "public"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "dataOrigin" "public"."DataOrigin" NOT NULL DEFAULT 'USER_SUBMITTED',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalFilename" TEXT,
    "mediaType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "storageKey" TEXT,
    "sha256" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceIdentifier" TEXT,
    "reportingPeriodStart" TIMESTAMP(3),
    "reportingPeriodEnd" TIMESTAMP(3),
    "structuredData" JSONB,
    "submittedById" TEXT NOT NULL,
    "provenanceType" "public"."ProvenanceType" NOT NULL DEFAULT 'USER_ASSERTED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Assessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assessmentVersion" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "public"."RiskLevel" NOT NULL,
    "assessmentStatus" "public"."AssessmentStatus" NOT NULL,
    "findingsSummary" JSONB NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AssessmentFinding" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" "public"."FindingSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "affectedEvidenceIds" TEXT[],
    "affectedFields" TEXT[],
    "observedValues" JSONB,
    "expectedCondition" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "public"."ReviewDecision" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CreditBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalRegistryReference" TEXT,
    "batchReference" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "totalQuantity" BIGINT NOT NULL,
    "issuedQuantity" BIGINT NOT NULL DEFAULT 0,
    "retiredQuantity" BIGINT NOT NULL DEFAULT 0,
    "lifecycleStatus" "public"."CreditLifecycleStatus" NOT NULL DEFAULT 'REGISTERED',
    "contractAddress" TEXT,
    "chainId" INTEGER,
    "onChainRecordId" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CreditLifecycleEvent" (
    "id" TEXT NOT NULL,
    "creditBatchId" TEXT NOT NULL,
    "eventType" "public"."CreditEventType" NOT NULL,
    "quantity" BIGINT NOT NULL,
    "actorId" TEXT NOT NULL,
    "transactionHash" TEXT,
    "blockNumber" BIGINT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."BlockchainRecord" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "transactionHash" TEXT,
    "blockNumber" BIGINT,
    "recordIdentifier" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "public"."BlockchainRecordStatus" NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlockchainRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
CREATE INDEX "User_role_status_idx" ON "public"."User"("role", "status");
CREATE UNIQUE INDEX "Project_slug_key" ON "public"."Project"("slug");
CREATE INDEX "Project_projectStatus_createdAt_idx" ON "public"."Project"("projectStatus", "createdAt");
CREATE INDEX "Project_createdById_idx" ON "public"."Project"("createdById");
CREATE UNIQUE INDEX "Project_registryName_externalProjectId_key" ON "public"."Project"("registryName", "externalProjectId");
CREATE INDEX "Evidence_projectId_createdAt_idx" ON "public"."Evidence"("projectId", "createdAt");
CREATE INDEX "Evidence_projectId_sha256_idx" ON "public"."Evidence"("projectId", "sha256");
CREATE INDEX "Evidence_sourceIdentifier_idx" ON "public"."Evidence"("sourceIdentifier");
CREATE INDEX "Assessment_projectId_assessedAt_idx" ON "public"."Assessment"("projectId", "assessedAt");
CREATE INDEX "AssessmentFinding_assessmentId_severity_idx" ON "public"."AssessmentFinding"("assessmentId", "severity");
CREATE INDEX "AssessmentFinding_ruleId_idx" ON "public"."AssessmentFinding"("ruleId");
CREATE INDEX "Review_assessmentId_createdAt_idx" ON "public"."Review"("assessmentId", "createdAt");
CREATE INDEX "CreditBatch_lifecycleStatus_createdAt_idx" ON "public"."CreditBatch"("lifecycleStatus", "createdAt");
CREATE UNIQUE INDEX "CreditBatch_projectId_batchReference_key" ON "public"."CreditBatch"("projectId", "batchReference");
CREATE UNIQUE INDEX "CreditLifecycleEvent_idempotencyKey_key" ON "public"."CreditLifecycleEvent"("idempotencyKey");
CREATE INDEX "CreditLifecycleEvent_creditBatchId_createdAt_idx" ON "public"."CreditLifecycleEvent"("creditBatchId", "createdAt");
CREATE INDEX "BlockchainRecord_entityId_recordType_idx" ON "public"."BlockchainRecord"("entityId", "recordType");
CREATE INDEX "BlockchainRecord_transactionHash_idx" ON "public"."BlockchainRecord"("transactionHash");
CREATE UNIQUE INDEX "BlockchainRecord_recordType_recordIdentifier_chainId_key" ON "public"."BlockchainRecord"("recordType", "recordIdentifier", "chainId");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "public"."AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "public"."AuditEvent"("actorId", "createdAt");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "public"."IdempotencyRecord"("expiresAt");
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "public"."IdempotencyRecord"("scope", "key");

ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Evidence" ADD CONSTRAINT "Evidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Assessment" ADD CONSTRAINT "Assessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AssessmentFinding" ADD CONSTRAINT "AssessmentFinding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."CreditBatch" ADD CONSTRAINT "CreditBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CreditLifecycleEvent" ADD CONSTRAINT "CreditLifecycleEvent_creditBatchId_fkey" FOREIGN KEY ("creditBatchId") REFERENCES "public"."CreditBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CreditLifecycleEvent" ADD CONSTRAINT "CreditLifecycleEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
