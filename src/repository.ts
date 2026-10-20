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
} from './domain.js';
import { getActiveConfig } from './config.js';
import { createPrismaStore } from './prisma-store/index.js';

export interface Store {
  users: Map<string, User>;
  projects: Map<string, Project>;
  evidence: Map<string, Evidence>;
  assessments: Map<string, Assessment>;
  findings: Map<string, AssessmentFinding>;
  reviews: Map<string, Review>;
  creditBatches: Map<string, CreditBatch>;
  creditEvents: Map<string, CreditLifecycleEvent>;
  blockchainRecords: Map<string, BlockchainRecord>;
  auditEvents: Map<string, AuditEvent>;
  idempotency: Map<string, IdempotencyRecord>;
  /** Optional lifecycle metadata keeps existing Map-shaped Store implementations compatible. */
  readonly mode?: 'memory' | 'prisma';
  readonly ready?: Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export function createStore(): Store {
  const config = getActiveConfig();
  if (!config.USE_IN_MEMORY) return createPrismaStore(config.DATABASE_URL);

  return {
    users: new Map(),
    projects: new Map(),
    evidence: new Map(),
    assessments: new Map(),
    findings: new Map(),
    reviews: new Map(),
    creditBatches: new Map(),
    creditEvents: new Map(),
    blockchainRecords: new Map(),
    auditEvents: new Map(),
    idempotency: new Map(),
    mode: 'memory',
    ready: Promise.resolve(),
    flush: async () => undefined,
    close: async () => undefined,
  };
}
