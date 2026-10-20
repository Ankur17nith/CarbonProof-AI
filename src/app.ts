import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { loadConfig, type AppConfig } from './config.js';
import { createUser, authenticate, issueToken, requireAuth, passwordMatches } from './auth.js';
import { createStore, type Store } from './repository.js';
import { createBlockchainAdapter, type BlockchainAdapter } from './blockchain/index.js';
import { AppService, type BlockchainWorkflowMetadata } from './service.js';
import { LocalFileStorage, contentLooksValid } from './storage.js';
import { serialize, type Project } from './domain.js';

const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  description: z.string().max(5000).optional(),
  projectType: z.string().trim().min(1).max(120),
  methodology: z.string().trim().min(1).max(200),
  countryOrRegion: z.string().max(120).optional(),
  registryName: z.string().max(160).optional(),
  externalProjectId: z.string().max(200).optional(),
  externalProjectUrl: z.string().url().optional(),
  projectStatus: z
    .enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED_INTERNAL', 'REJECTED'])
    .optional(),
  dataOrigin: z.enum(['USER_SUBMITTED', 'REGISTRY_REFERENCE', 'SYNTHETIC_DEMO']).optional(),
  isSynthetic: z.boolean().optional(),
});
const patchProjectSchema = projectSchema.partial();
const evidenceMetadataSchema = z.object({
  evidenceType: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  originalFilename: z.string().max(255).optional(),
  mediaType: z.string().min(1).max(120),
  sourceUrl: z.string().url().optional(),
  sourceIdentifier: z.string().max(240).optional(),
  reportingPeriodStart: z.string().datetime().optional(),
  reportingPeriodEnd: z.string().datetime().optional(),
  structuredData: z.unknown().optional(),
  provenanceType: z
    .enum(['PRIMARY_SOURCE', 'REGISTRY_REFERENCE', 'USER_ASSERTED', 'SYNTHETIC'])
    .optional(),
  isPublic: z.boolean().optional(),
});
const assessmentSchema = z.object({
  evidenceIds: z.array(z.string().min(1)).max(1000).optional(),
  verification: z
    .object({
      project: z.record(z.string(), z.unknown()).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const reviewSchema = z.object({
  decision: z.enum(['APPROVED_FOR_INTERNAL_REVIEW', 'REJECTED', 'NEEDS_MORE_EVIDENCE']),
  rationale: z.string().trim().min(10).max(5000),
});
const batchSchema = z.object({
  projectId: z.string().min(1),
  externalRegistryReference: z.string().max(240).optional(),
  batchReference: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(80),
  totalQuantity: z.string().regex(/^\d+$/),
  isSynthetic: z.boolean().optional(),
});
const quantitySchema = z.object({ quantity: z.string().regex(/^\d+$/) });

export interface AppContext {
  app: express.Express;
  service: AppService;
  store: Store;
  config: AppConfig;
  blockchain: BlockchainAdapter;
}

export async function createApp(
  configOverrides: Partial<AppConfig> = {},
  suppliedStore?: Store,
  suppliedBlockchain?: BlockchainAdapter,
): Promise<AppContext> {
  const config = loadConfig(configOverrides);
  const store = suppliedStore ?? createStore();
  if (store.ready) await store.ready;
  const blockchain =
    suppliedBlockchain ??
    createBlockchainAdapter({
      enabled: config.BLOCKCHAIN_ENABLED,
      rpcUrl: config.BLOCKCHAIN_RPC_URL,
      chainId: config.BLOCKCHAIN_CHAIN_ID,
      contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS,
      signerPrivateKey: config.BLOCKCHAIN_SIGNER_PRIVATE_KEY,
    });
  const storage = new LocalFileStorage(config.FILE_STORAGE_ROOT);
  const service = new AppService(store, storage, config, blockchain);
  const logger = pino({
    level: config.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ALLOWED_ORIGINS.split(',').map((item) => item.trim()),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: config.MAX_UPLOAD_SIZE }));
  app.use(express.urlencoded({ extended: false, limit: config.MAX_UPLOAD_SIZE }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (request: Request) => request.header('x-correlation-id') ?? randomUUID(),
    }),
  );
  app.use((request, _response, next) => {
    request.correlationId = String(request.id);
    next();
  });
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (request) => request.path === '/health/live',
    }),
  );
  app.use(authenticate(config, store));

  if (config.NODE_ENV !== 'production' && store.users.size === 0) {
    const password = config.DEV_BOOTSTRAP_PASSWORD ?? 'development-only-password-123';
    await createUser(store, {
      email: 'contributor@example.test',
      displayName: 'Demo Contributor',
      password,
      role: 'CONTRIBUTOR',
    });
    await createUser(store, {
      email: 'reviewer@example.test',
      displayName: 'Demo Reviewer',
      password,
      role: 'REVIEWER',
    });
    await createUser(store, {
      email: 'admin@example.test',
      displayName: 'Demo Administrator',
      password,
      role: 'ADMIN',
    });
  }

  const send = (response: Response, data: unknown, status = 200): void => {
    response.status(status).json({ data: serialize(data), requestId: String(response.req.id) });
  };
  const wrap =
    (handler: (request: Request, response: Response) => Promise<void> | void) =>
    (request: Request, response: Response, next: NextFunction): void => {
      Promise.resolve(handler(request, response)).catch(next);
    };
  const auth = (request: Request): NonNullable<Request['auth']> => {
    if (!request.auth)
      throw Object.assign(new Error('Authentication is required.'), {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      });
    return request.auth;
  };
  const canAccessProject = (request: Request, projectId: string): void => {
    const user = auth(request);
    const project = service.getProject(projectId);
    if (user.role !== 'ADMIN' && user.role !== 'REVIEWER' && project.createdById !== user.id)
      throw Object.assign(new Error('You do not have permission for this project.'), {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
  };
  const parsePage = (request: Request) => ({
    page: Math.max(1, Number(request.query.page ?? 1) || 1),
    pageSize: Math.min(100, Math.max(1, Number(request.query.pageSize ?? 20) || 20)),
  });
  const param = (request: Request, name: string): string => {
    const value = request.params[name];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.MAX_UPLOAD_SIZE, files: 1 },
  });

  app.get('/health/live', (_request, response) =>
    send(response, { status: 'ok', service: 'carbonproof-ai' }),
  );
  app.get(
    '/health/ready',
    wrap(async (_request, response) => {
      const storageReady = await storage.health();
      const blockchainHealth = await blockchain.health();
      send(
        response,
        {
          status: storageReady && (store.mode !== 'prisma' || store.ready) ? 'ready' : 'not_ready',
          dependencies: {
            storage: storageReady ? 'ok' : 'unavailable',
            database: store.mode === 'prisma' ? 'postgresql' : 'in-memory',
            blockchain: blockchainHealth.status,
            ai: config.AI_PROVIDER,
          },
        },
        storageReady ? 200 : 503,
      );
    }),
  );
  app.get(
    `${config.API_PREFIX}/health`,
    wrap(async (_request, response) => {
      const storageReady = await storage.health();
      const blockchainHealth = await blockchain.health();
      send(
        response,
        {
          status: storageReady ? 'ok' : 'not_ready',
          readiness: {
            storage: storageReady,
            database: store.mode === 'prisma',
            blockchain: blockchainHealth,
            ai: config.AI_PROVIDER === 'local',
          },
        },
        storageReady ? 200 : 503,
      );
    }),
  );

  app.get('/openapi.json', (_request, response) => send(response, openApi(config)));
  app.get('/docs', (_request, response) =>
    response
      .type('html')
      .send(
        '<!doctype html><html><body><h1>CarbonProof AI API</h1><p>OpenAPI document: <a href="/openapi.json">/openapi.json</a></p></body></html>',
      ),
  );

  app.post(
    `${config.API_PREFIX}/auth/login`,
    wrap(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const user = [...store.users.values()].find(
        (item) => item.email === input.email.toLowerCase() && item.status === 'ACTIVE',
      );
      if (!user || !(await passwordMatches(input.password, user.passwordHash)))
        throw Object.assign(new Error('Invalid email or password.'), {
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
        });
      send(response, {
        accessToken: issueToken(user, config),
        tokenType: 'Bearer',
        expiresIn: config.JWT_EXPIRES_IN,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      });
    }),
  );
  app.get(`${config.API_PREFIX}/auth/me`, requireAuth(), (request, response) =>
    send(response, request.auth),
  );

  app.post(
    `${config.API_PREFIX}/projects`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const input = projectSchema.parse(request.body);
      const project = service.createProject(input, auth(request), String(request.id));
      send(response, project, 201);
    }),
  );
  app.get(
    `${config.API_PREFIX}/projects`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const user = auth(request);
      const result = service.listProjects({
        ...parsePage(request),
        search: typeof request.query.search === 'string' ? request.query.search : undefined,
        status:
          typeof request.query.status === 'string'
            ? (request.query.status as Project['projectStatus'])
            : undefined,
        createdById: user.role === 'CONTRIBUTOR' ? user.id : undefined,
        sort: request.query.sort === 'name' ? 'name' : 'createdAt',
      });
      send(response, result);
    },
  );
  app.get(
    `${config.API_PREFIX}/projects/:id`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      send(response, service.getProject(projectId));
    },
  );
  app.patch(
    `${config.API_PREFIX}/projects/:id`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      send(
        response,
        service.updateProject(
          projectId,
          patchProjectSchema.parse(request.body),
          auth(request),
          String(request.id),
        ),
      );
    }),
  );
  app.get(
    `${config.API_PREFIX}/projects/:id/evidence`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      send(
        response,
        service
          .getProjectEvidence(projectId)
          .map((item) =>
            evidenceMetadata(item, service.blockchainMetadata('EVIDENCE_REGISTRATION', item.id)),
          ),
      );
    },
  );
  app.get(
    `${config.API_PREFIX}/projects/:id/assessments`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      send(response, service.listAssessments(projectId));
    },
  );
  app.get(
    `${config.API_PREFIX}/projects/:id/credits`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      send(response, service.listCreditBatches(projectId));
    },
  );

  app.post(
    `${config.API_PREFIX}/projects/:id/evidence`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    upload.single('file'),
    wrap(async (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      const file = request.file;
      const isMultipart = Boolean(file);
      const raw = isMultipart ? request.body : request.body;
      const input = evidenceMetadataSchema.parse({
        ...raw,
        structuredData:
          typeof raw.structuredData === 'string'
            ? JSON.parse(raw.structuredData)
            : raw.structuredData,
        mediaType: file?.mimetype ?? raw.mediaType,
        originalFilename: file?.originalname ?? raw.originalFilename,
      });
      const bytes =
        file?.buffer ?? Buffer.from(JSON.stringify(raw.content ?? raw.structuredData ?? {}));
      if (!contentLooksValid(input.mediaType, bytes))
        throw Object.assign(
          new Error('The uploaded content does not match its declared media type.'),
          { statusCode: 415, code: 'INVALID_CONTENT_SIGNATURE' },
        );
      const evidence = await service.addEvidence(
        projectId,
        input,
        bytes,
        auth(request),
        String(request.id),
      );
      send(
        response,
        evidenceMetadata(
          evidence,
          service.blockchainMetadata('EVIDENCE_REGISTRATION', evidence.id),
        ),
        201,
      );
    }),
  );
  app.get(
    `${config.API_PREFIX}/evidence/:id`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      canAccessProject(request, evidence.projectId);
      send(
        response,
        evidenceMetadata(
          evidence,
          service.blockchainMetadata('EVIDENCE_REGISTRATION', evidence.id),
        ),
      );
    },
  );
  app.get(
    `${config.API_PREFIX}/evidence/:id/metadata`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      canAccessProject(request, evidence.projectId);
      send(
        response,
        evidenceMetadata(
          evidence,
          service.blockchainMetadata('EVIDENCE_REGISTRATION', evidence.id),
        ),
      );
    },
  );
  app.get(
    `${config.API_PREFIX}/evidence/:id/hash`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      canAccessProject(request, evidence.projectId);
      send(response, { id: evidence.id, sha256: evidence.sha256 });
    },
  );
  app.get(
    `${config.API_PREFIX}/evidence/:id/download`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      canAccessProject(request, evidence.projectId);
      const bytes = await service.readEvidence(evidence.id);
      response
        .type(evidence.mediaType)
        .setHeader(
          'Content-Disposition',
          `attachment; filename="${safeFilename(evidence.originalFilename ?? evidence.id)}"`,
        )
        .send(bytes);
    }),
  );
  app.post(
    `${config.API_PREFIX}/evidence/:id/verify-integrity`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      canAccessProject(request, evidence.projectId);
      send(
        response,
        await service.verifyEvidenceIntegrity(evidence.id, auth(request), String(request.id)),
      );
    }),
  );
  app.delete(`${config.API_PREFIX}/evidence/:id`, requireAuth('ADMIN'), (_request, response) => {
    response.status(501).json({
      error: {
        code: 'RETENTION_POLICY',
        message: 'Evidence deletion is disabled by the prototype retention policy.',
        requestId: response.req.id,
      },
    });
  });

  app.post(
    `${config.API_PREFIX}/projects/:id/assessments`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const projectId = param(request, 'id');
      canAccessProject(request, projectId);
      const result = service.createAssessment(
        projectId,
        assessmentSchema.parse(request.body),
        auth(request),
        String(request.id),
      );
      send(response, result, 201);
    }),
  );
  app.get(
    `${config.API_PREFIX}/assessments`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const user = auth(request);
      const projects = new Set(
        service
          .listProjects({
            page: 1,
            pageSize: 10000,
            createdById: user.role === 'CONTRIBUTOR' ? user.id : undefined,
            sort: 'createdAt',
          })
          .items.map((item) => item.id),
      );
      send(
        response,
        service
          .listAssessments()
          .filter((item) => user.role !== 'CONTRIBUTOR' || projects.has(item.projectId)),
      );
    },
  );
  app.get(
    `${config.API_PREFIX}/assessments/:id`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const assessment = service.getAssessment(param(request, 'id'));
      canAccessProject(request, assessment.projectId);
      send(response, {
        assessment,
        findings: service.getFindings(assessment.id),
        reviews: service.getReviews(assessment.id),
      });
    },
  );
  app.get(
    `${config.API_PREFIX}/assessments/:id/findings`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const assessment = service.getAssessment(param(request, 'id'));
      canAccessProject(request, assessment.projectId);
      send(response, service.getFindings(assessment.id));
    },
  );
  app.get(
    `${config.API_PREFIX}/assessments/:id/report`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const assessment = service.getAssessment(param(request, 'id'));
      canAccessProject(request, assessment.projectId);
      send(response, {
        assessment,
        findings: service.getFindings(assessment.id),
        methodology: {
          score:
            'riskScore is the sum of configured rule weights multiplied by severity multipliers, capped at 100; it is a prioritization signal, not a probability of fraud.',
        },
      });
    },
  );

  app.get(
    `${config.API_PREFIX}/reviews/queue`,
    requireAuth('REVIEWER', 'ADMIN'),
    (_request, response) =>
      send(
        response,
        service
          .listAssessments()
          .filter(
            (assessment) =>
              assessment.assessmentStatus === 'COMPLETED_WITH_FINDINGS' ||
              assessment.assessmentStatus === 'COMPLETED_NO_FINDINGS',
          ),
      ),
  );
  app.post(
    `${config.API_PREFIX}/assessments/:id/reviews`,
    requireAuth('REVIEWER', 'ADMIN'),
    wrap(async (request, response) => {
      const assessment = service.getAssessment(param(request, 'id'));
      const reviewInput = reviewSchema.parse(request.body);
      const review = service.createReview(
        assessment.id,
        reviewInput.decision,
        reviewInput.rationale,
        auth(request),
        String(request.id),
      );
      send(response, review, 201);
    }),
  );
  app.get(
    `${config.API_PREFIX}/assessments/:id/reviews`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const assessment = service.getAssessment(param(request, 'id'));
      canAccessProject(request, assessment.projectId);
      send(response, service.getReviews(assessment.id));
    },
  );
  app.get(
    `${config.API_PREFIX}/reviews/:id`,
    requireAuth('REVIEWER', 'ADMIN'),
    (request, response) => {
      const review = store.reviews.get(param(request, 'id'));
      if (!review)
        throw Object.assign(new Error('Review was not found.'), {
          statusCode: 404,
          code: 'REVIEW_NOT_FOUND',
        });
      send(response, review);
    },
  );

  app.post(
    `${config.API_PREFIX}/credits/batches`,
    requireAuth('CONTRIBUTOR', 'ADMIN'),
    wrap(async (request, response) => {
      const batch = service.createCreditBatch(
        batchSchema.parse(request.body),
        auth(request),
        String(request.id),
      );
      send(response, batch, 201);
    }),
  );
  app.get(
    `${config.API_PREFIX}/credits/batches`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) =>
      send(
        response,
        service.listCreditBatches(
          typeof request.query.projectId === 'string' ? request.query.projectId : undefined,
        ),
      ),
  );
  app.get(
    `${config.API_PREFIX}/credits/batches/:id`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const batch = service.getCreditBatch(param(request, 'id'));
      canAccessProject(request, batch.projectId);
      send(response, { batch, events: service.getCreditEvents(batch.id) });
    },
  );
  app.post(
    `${config.API_PREFIX}/credits/batches/:id/issue`,
    requireAuth('ADMIN'),
    wrap(async (request, response) => {
      const batch = service.getCreditBatch(param(request, 'id'));
      canAccessProject(request, batch.projectId);
      const key = request.header('idempotency-key');
      if (!key)
        throw Object.assign(new Error('Idempotency-Key is required.'), {
          statusCode: 400,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      send(
        response,
        await service.mutateCredit(
          batch.id,
          'ISSUED',
          quantitySchema.parse(request.body).quantity,
          key,
          auth(request),
          String(request.id),
        ),
        201,
      );
    }),
  );
  app.post(
    `${config.API_PREFIX}/credits/batches/:id/retire`,
    requireAuth('ADMIN'),
    wrap(async (request, response) => {
      const batch = service.getCreditBatch(param(request, 'id'));
      canAccessProject(request, batch.projectId);
      const key = request.header('idempotency-key');
      if (!key)
        throw Object.assign(new Error('Idempotency-Key is required.'), {
          statusCode: 400,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      send(
        response,
        await service.mutateCredit(
          batch.id,
          'RETIRED',
          quantitySchema.parse(request.body).quantity,
          key,
          auth(request),
          String(request.id),
        ),
        201,
      );
    }),
  );
  app.get(
    `${config.API_PREFIX}/credits/batches/:id/events`,
    requireAuth('CONTRIBUTOR', 'REVIEWER', 'ADMIN'),
    (request, response) => {
      const batch = service.getCreditBatch(param(request, 'id'));
      canAccessProject(request, batch.projectId);
      send(response, service.getCreditEvents(batch.id));
    },
  );
  app.get(`${config.API_PREFIX}/credits/verify/:recordId`, (request, response) => {
    const batch = service.getCreditBatch(request.params.recordId);
    send(
      response,
      publicCredit(
        batch,
        service.getCreditEvents(batch.id),
        config,
        service.blockchainMetadata(['CREDIT_ISSUANCE', 'CREDIT_RETIREMENT'], batch.id),
      ),
    );
  });
  app.get(`${config.API_PREFIX}/audit`, requireAuth('ADMIN'), (request, response) =>
    send(
      response,
      service.listAudit({
        ...parsePage(request),
        entityType:
          typeof request.query.entityType === 'string' ? request.query.entityType : undefined,
        entityId: typeof request.query.entityId === 'string' ? request.query.entityId : undefined,
      }),
    ),
  );

  app.get(`${config.API_PREFIX}/public/projects/:id`, (request, response) =>
    send(response, service.publicProject(param(request, 'id'))),
  );
  app.get(`${config.API_PREFIX}/public/projects/:id/assessments/latest`, (request, response) => {
    const latest = service.listAssessments(param(request, 'id'))[0];
    if (!latest)
      throw Object.assign(new Error('No assessment was found.'), {
        statusCode: 404,
        code: 'ASSESSMENT_NOT_FOUND',
      });
    send(response, {
      id: latest.id,
      projectId: latest.projectId,
      riskScore: latest.riskScore,
      riskLevel: latest.riskLevel,
      assessmentStatus: latest.assessmentStatus,
      ruleSetVersion: latest.ruleSetVersion,
      assessedAt: latest.assessedAt,
    });
  });
  app.get(
    `${config.API_PREFIX}/public/evidence/:id/verify`,
    wrap(async (request, response) => {
      const evidence = service.getEvidence(param(request, 'id'));
      if (!evidence.isPublic)
        throw Object.assign(new Error('This evidence is not publicly disclosed.'), {
          statusCode: 404,
          code: 'EVIDENCE_NOT_PUBLIC',
        });
      send(
        response,
        await service.verifyEvidenceIntegrity(evidence.id, undefined, String(request.id)),
      );
    }),
  );
  app.get(`${config.API_PREFIX}/public/credits/:recordId`, (request, response) => {
    const batch = service.getCreditBatch(request.params.recordId);
    send(
      response,
      publicCredit(
        batch,
        service.getCreditEvents(batch.id),
        config,
        service.blockchainMetadata(['CREDIT_ISSUANCE', 'CREDIT_RETIREMENT'], batch.id),
      ),
    );
  });
  app.get(`${config.API_PREFIX}/public/credits/:recordId/history`, (request, response) => {
    const batch = service.getCreditBatch(request.params.recordId);
    send(response, {
      recordId: batch.id,
      history: service.getCreditEvents(batch.id).map((event) => ({
        eventType: event.eventType,
        quantity: event.quantity,
        createdAt: event.createdAt,
        transactionHash: event.transactionHash,
      })),
    });
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : error instanceof z.ZodError
          ? 422
          : 500;
    const code =
      error instanceof z.ZodError
        ? 'VALIDATION_ERROR'
        : typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof error.code === 'string'
          ? error.code
          : 'INTERNAL_ERROR';
    const message =
      status >= 500
        ? 'An unexpected internal error occurred.'
        : error instanceof Error
          ? error.message
          : 'Request failed.';
    const details =
      error instanceof z.ZodError
        ? error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
        : undefined;
    request.log?.error({ err: error, code, status }, 'request failed');
    response.status(status).json({
      error: { code, message, requestId: String(request.id), ...(details ? { details } : {}) },
    });
  });
  return { app, service, store, config, blockchain };
}

function evidenceMetadata(
  evidence: {
    id: string;
    projectId: string;
    evidenceType: string;
    title: string;
    description?: string;
    originalFilename?: string;
    mediaType: string;
    fileSize: number;
    sha256: string;
    sourceUrl?: string;
    sourceIdentifier?: string;
    reportingPeriodStart?: string;
    reportingPeriodEnd?: string;
    structuredData?: unknown;
    provenanceType: string;
    createdAt: string;
    isPublic: boolean;
  },
  blockchain?: BlockchainWorkflowMetadata,
): Record<string, unknown> {
  return {
    ...evidence,
    structuredData: evidence.structuredData,
    sha256: evidence.sha256,
    ...(blockchain ? { blockchain } : {}),
  };
}
function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
function publicCredit(
  batch: {
    id: string;
    projectId: string;
    batchReference: string;
    unit: string;
    totalQuantity: bigint;
    issuedQuantity: bigint;
    retiredQuantity: bigint;
    lifecycleStatus: string;
    contractAddress?: string;
    chainId?: number;
    onChainRecordId?: string;
    isSynthetic: boolean;
  },
  events: unknown[],
  config: AppConfig,
  blockchain?: BlockchainWorkflowMetadata,
): Record<string, unknown> {
  return {
    recordId: batch.id,
    projectId: batch.projectId,
    batchReference: batch.batchReference,
    unit: batch.unit,
    totalQuantity: batch.totalQuantity,
    issuedQuantity: batch.issuedQuantity,
    retiredQuantity: batch.retiredQuantity,
    availableQuantity: batch.issuedQuantity - batch.retiredQuantity,
    lifecycleStatus: batch.lifecycleStatus,
    isSynthetic: batch.isSynthetic,
    blockchain: blockchain ?? {
      enabled: config.BLOCKCHAIN_ENABLED,
      status: config.BLOCKCHAIN_ENABLED ? 'not_attempted' : 'disabled',
      chainId: batch.chainId,
      contractAddress: batch.contractAddress,
      recordIdentifier: batch.onChainRecordId,
    },
    events,
  };
}
function openApi(config: AppConfig): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'CarbonProof AI API',
      version: '0.1.0',
      description:
        'Evidence-first carbon verification assistance API. Risk scores are prioritization signals, not scientific certification.',
    },
    servers: [{ url: config.API_PREFIX }],
    paths: {
      '/auth/login': { post: { summary: 'Issue a bearer token' } },
      '/projects': { get: { summary: 'List projects' }, post: { summary: 'Create a project' } },
      '/projects/{id}/evidence': { post: { summary: 'Submit evidence' } },
      '/projects/{id}/assessments': { post: { summary: 'Run deterministic assessment' } },
      '/credits/batches/{id}/issue': { post: { summary: 'Issue credits with Idempotency-Key' } },
      '/credits/batches/{id}/retire': { post: { summary: 'Retire credits with Idempotency-Key' } },
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  };
}
