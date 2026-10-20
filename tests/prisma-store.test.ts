import { describe, expect, it } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getActiveConfig, loadConfig } from '../src/config.js';
import { createStore } from '../src/repository.js';
import { createPrismaStore, PrismaMap } from '../src/prisma-store/index.js';
import {
  fromPrismaBigInt,
  fromPrismaDate,
  toOptionalPrismaJson,
  toPrismaBigInt,
  toPrismaDate,
  toPrismaJson,
} from '../src/prisma-store/mapping.js';

/**
 * These tests are intentionally offline and never construct a PrismaClient.
 * Live verification, when PostgreSQL is available, is:
 * `docker compose up -d postgres && npm run prisma:migrate && npm run prisma:seed`,
 * followed by starting the API with `USE_IN_MEMORY=false` and checking that a
 * created project remains after restarting the process. That verification is
 * not run here because this test environment does not provide a live database.
 */
describe('Prisma store boundary', () => {
  it('maps BigInt and nested JSON values without JSON.stringify failures', () => {
    const quantity = 900719925474099312345678n;
    const json = toPrismaJson({ quantity, nested: [1n, { enabled: true }], omitted: undefined });

    expect(json).toEqual({
      quantity: quantity.toString(),
      nested: ['1', { enabled: true }],
    });
    expect(toPrismaBigInt(quantity.toString())).toBe(quantity);
    expect(fromPrismaBigInt(quantity)).toBe(quantity);
    expect(toOptionalPrismaJson(undefined)).toBeUndefined();
    expect(toPrismaJson(null)).toBe(Prisma.JsonNull);
  });

  it('maps dates to stable ISO/Prisma representations', () => {
    const value = '2026-10-20T12:34:56.789Z';

    expect(toPrismaDate(value)).toEqual(new Date(value));
    expect(fromPrismaDate(new Date(value))).toBe(value);
  });

  it('keeps the synchronous Map contract while scheduling persistence', () => {
    const persisted: string[] = [];
    const map = new PrismaMap<{ id: string }>((value) => persisted.push(value.id), true);

    expect(map.size).toBe(1);
    map.load([['first', { id: 'first' }]]);
    expect(map.get('first')).toEqual({ id: 'first' });
    expect(map.size).toBe(1);

    map.set('second', { id: 'second' });
    expect([...map.keys()]).toEqual(['first', 'second']);
    expect(persisted).toEqual(['second']);
  });

  it('routes every supported record collection through Prisma upserts', async () => {
    const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
    const model = (name: string) => ({
      findMany: async () => [],
      upsert: async (args: Record<string, unknown>) => {
        calls.push({ model: name, args });
        return {};
      },
    });
    const client = {
      user: model('user'),
      project: model('project'),
      evidence: model('evidence'),
      assessment: model('assessment'),
      assessmentFinding: model('assessmentFinding'),
      review: model('review'),
      creditBatch: model('creditBatch'),
      creditLifecycleEvent: model('creditLifecycleEvent'),
      blockchainRecord: model('blockchainRecord'),
      auditEvent: model('auditEvent'),
      idempotencyRecord: model('idempotencyRecord'),
      $disconnect: async () => undefined,
    } as unknown as PrismaClient;
    const config = loadConfig({
      NODE_ENV: 'test',
      USE_IN_MEMORY: false,
      DATABASE_URL: 'postgresql://unused/for-offline-test',
    });
    const store = createPrismaStore(config.DATABASE_URL, client);
    const createdAt = '2026-10-20T12:34:56.789Z';

    await store.ready;
    store.users.set('user-1', {
      id: 'user-1',
      email: 'user@example.test',
      displayName: 'User',
      passwordHash: 'hash',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt,
      updatedAt: createdAt,
    });
    store.projects.set('project-1', {
      id: 'project-1',
      name: 'Project',
      slug: 'project',
      projectType: 'REFORESTATION',
      methodology: 'Demo',
      projectStatus: 'DRAFT',
      dataOrigin: 'USER_SUBMITTED',
      isSynthetic: false,
      createdById: 'user-1',
      createdAt,
      updatedAt: createdAt,
    });
    store.evidence.set('evidence-1', {
      id: 'evidence-1',
      projectId: 'project-1',
      evidenceType: 'report',
      title: 'Report',
      mediaType: 'application/json',
      fileSize: 12,
      sha256: 'hash',
      submittedById: 'user-1',
      provenanceType: 'USER_ASSERTED',
      createdAt,
      isPublic: false,
      structuredData: { quantity: 12n },
    });
    store.assessments.set('assessment-1', {
      id: 'assessment-1',
      projectId: 'project-1',
      assessmentVersion: '1.0.0',
      ruleSetVersion: 'rules@1',
      riskScore: 10,
      riskLevel: 'LOW',
      assessmentStatus: 'COMPLETED_NO_FINDINGS',
      findingsSummary: { count: 0 },
      evidenceSnapshot: [],
      assessedAt: createdAt,
      createdById: 'user-1',
      createdAt,
    });
    store.findings.set('finding-1', {
      id: 'finding-1',
      assessmentId: 'assessment-1',
      ruleId: 'rule-1',
      severity: 'LOW',
      category: 'quality',
      title: 'Finding',
      explanation: 'Explanation',
      affectedEvidenceIds: ['evidence-1'],
      affectedFields: ['quantity'],
      expectedCondition: 'positive',
      recommendation: 'Review',
      createdAt,
    });
    store.reviews.set('review-1', {
      id: 'review-1',
      assessmentId: 'assessment-1',
      reviewerId: 'user-1',
      decision: 'REJECTED',
      rationale: 'Needs more evidence.',
      createdAt,
    });
    store.creditBatches.set('batch-1', {
      id: 'batch-1',
      projectId: 'project-1',
      batchReference: 'BATCH-1',
      unit: 'tCO2e',
      totalQuantity: 100n,
      issuedQuantity: 50n,
      retiredQuantity: 10n,
      lifecycleStatus: 'PARTIALLY_RETIRED',
      isSynthetic: false,
      createdAt,
      updatedAt: createdAt,
    });
    store.creditEvents.set('event-1', {
      id: 'event-1',
      creditBatchId: 'batch-1',
      eventType: 'ISSUED',
      quantity: 50n,
      actorId: 'user-1',
      idempotencyKey: 'event-1',
      metadata: { quantity: 50n },
      createdAt,
    });
    store.blockchainRecords.set('chain-1', {
      id: 'chain-1',
      recordType: 'credit',
      entityId: 'batch-1',
      chainId: 31337,
      contractAddress: '0xcontract',
      recordIdentifier: 'record-1',
      payloadHash: 'payload',
      status: 'PENDING',
      confirmations: 0,
      createdAt,
      updatedAt: createdAt,
    });
    store.auditEvents.set('audit-1', {
      id: 'audit-1',
      actorId: 'user-1',
      action: 'TEST',
      entityType: 'Project',
      entityId: 'project-1',
      correlationId: 'request-1',
      metadata: { value: 1n },
      createdAt,
    });
    store.idempotency.set('scope:key', {
      scope: 'scope',
      key: 'key',
      requestHash: 'request-hash',
      responseStatus: 200,
      responseBody: { value: 1n },
      createdAt,
      expiresAt: '2026-10-21T12:34:56.789Z',
    });

    await store.flush();

    expect(calls.map((call) => call.model)).toEqual([
      'user',
      'project',
      'evidence',
      'assessment',
      'assessmentFinding',
      'review',
      'creditBatch',
      'creditLifecycleEvent',
      'blockchainRecord',
      'auditEvent',
      'idempotencyRecord',
    ]);
    expect(calls[2]?.args.create).toMatchObject({
      fileSize: 12n,
      structuredData: { quantity: '12' },
    });
    expect(calls[6]?.args.create).toMatchObject({ totalQuantity: 100n });
    expect(calls[10]?.args.create).toMatchObject({ responseBody: { value: '1' } });

    await store.close();
  });

  it('selects the native in-memory store without creating Prisma state', async () => {
    const config = loadConfig({ NODE_ENV: 'test', USE_IN_MEMORY: true });
    const store = createStore();

    expect(config.USE_IN_MEMORY).toBe(true);
    expect(getActiveConfig()).toBe(config);
    expect(store.mode).toBe('memory');
    expect(store.users).toBeInstanceOf(Map);
    await expect(store.ready ?? Promise.resolve()).resolves.toBeUndefined();
    await expect(store.flush?.() ?? Promise.resolve()).resolves.toBeUndefined();
    await store.close?.();
  });
});
