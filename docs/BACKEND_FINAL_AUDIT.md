# CarbonProof AI backend final audit

**Review date:** October 20, 2026  
**Scope:** repository files under `src/`, `tests/`, `prisma/`, `contracts/`,
root build/configuration files, and the current test commands.  
This report records the final local implementation and the checks actually
executed in this workspace. It does not claim an independent professional
security audit, a public testnet deployment, or successful live PostgreSQL
verification in this container.

This is an evidence-based draft. Status labels mean:

- **Implemented** — behavior is present in source and/or covered by current
  repository tests.
- **Partial / integration-ready** — useful artifacts or isolated behavior exist,
  but the end-to-end runtime path is incomplete.
- **Not implemented / unverified** — the repository has no working implementation
  or the required check could not be run in the current environment.

## Executive status

The repository contains an Express TypeScript API with a deterministic
verification core, JWT authentication, local evidence storage, selectable
in-memory or Prisma-backed persistence, credit lifecycle bookkeeping, a viem
blockchain adapter, and an independent Solidity contract workspace.

The default runtime is in-memory, but `USE_IN_MEMORY=false` selects
`src/prisma-store/`, hydrates the collections, and persists Map-shaped service
mutations through Prisma. This mode was not verified against a live database
because PostgreSQL was unavailable. The blockchain adapter is wired into
evidence and credit workflows but remains disabled by default. There is no
evidence of a Sepolia deployment. No frontend source is present in this
repository.

The root TypeScript check is green: 35 of 35 Vitest tests pass, and
typecheck/lint/build/format checks pass. The Solidity test command remains
unverified because `forge` is unavailable in the workspace environment.

## Implemented

### Express TypeScript API

**Evidence:** `package.json`, `src/server.ts`, `src/app.ts`, `src/config.ts`.

- Express 5, TypeScript, Node ESM, and Zod request validation are configured.
- The server listens on `PORT` and uses `API_PREFIX`, defaulting to `/api/v1`.
- Liveness, readiness, OpenAPI JSON, and a small HTML documentation route are
  exposed.
- Project routes support create/list/read/update with pagination, search,
  status filtering, and role-aware project visibility.
- Evidence routes support submission, metadata, hash, download, integrity
  verification, and public verification for public evidence.
- Assessment routes create assessments and expose findings, reports, and
  reviews; a reviewer/admin queue is present.
- Credit routes create batches, list batches/events, issue and retire quantities,
  and expose public batch/history views.
- Admin audit listing and structured error responses include request IDs.

The OpenAPI document is a compact route summary. It is not a generated,
complete contract for every request and response field.

### Runtime store selection

**Evidence:** `src/repository.ts`, `src/prisma-store/index.ts`, `src/app.ts`.

`Store` is a set of Map-shaped collections for users, projects, evidence,
assessments, findings, reviews, credit batches/events, blockchain records, audit
events, and idempotency records. `createApp()` waits for the selected store to
hydrate before bootstrapping users. `createStore()` uses native Maps when
`USE_IN_MEMORY=true` and `PrismaStore` otherwise.

In-memory mode is ephemeral. Prisma mode persists the domain collections, but
its Map-compatible write queue still needs live multi-instance/concurrency
verification before production use.

### Local evidence storage and integrity

**Evidence:** `src/storage.ts`, `src/service.ts:119-163`, `src/app.ts:91-108`.

- Evidence bytes are stored beneath `FILE_STORAGE_ROOT` with safe-path checks.
- File creation uses exclusive write mode.
- SHA-256 is calculated and persisted in the selected runtime store.
- Duplicate evidence hashes are rejected per project.
- PDF, JSON, CSV, plain-text, and image content receive basic content checks.
- Integrity verification compares the stored bytes with the recorded hash.
- Download filenames are sanitized.
- Evidence deletion intentionally returns `501 RETENTION_POLICY`.

### JWT authentication and roles

**Evidence:** `src/auth.ts`, `src/config.ts:35-42`, `src/app.ts:51-58`.

- Passwords are hashed with bcryptjs.
- JWTs include the public user identity plus `sub`, issuer
  `carbonproof-ai`, audience `carbonproof-api`, and configured expiry.
- Invalid bearer tokens are treated as unauthenticated; protected routes then
  return `401`.
- Role middleware enforces contributor, reviewer, and admin access.
- Non-production empty stores bootstrap contributor, reviewer, and admin demo
  users.
- Production rejects development JWT secrets and rejects
  `USE_IN_MEMORY=true`.

There is no user registration, password reset, refresh-token, or account
management flow in the current API.

### Deterministic verification engine

**Evidence:** `src/verification/engine.ts`, `src/verification/rules.ts`,
`src/verification/models.ts`, `src/verification/explanations.ts`.

The engine implements:

- request validation and explicit validation errors;
- a versioned default registry,
  `carbonproof-verification-rules@1.0.0`;
- 14 deterministic rules for evidence completeness, identity, periods,
  boundaries, units, quantities, duplicate references/hashes, structure,
  provenance, numeric values, and credit accounting;
- stable evidence ordering, finding deduplication, stable short-hash finding
  IDs, and deterministic explanations;
- configurable enabled/disabled rules, rule weights, severity multipliers,
  quantity tolerance, and period match mode;
- `VALIDATION_ERROR`, `COMPLETED_WITH_FINDINGS`,
  `COMPLETED_NO_FINDINGS`, and `FAILED` outcomes;
- risk levels derived from capped risk scores.

The source explicitly describes risk score as a prioritization signal, not a
probability of fraud or a certification decision. The API uses the local
explanation provider and does not invoke an external AI service.

### Credit registry bookkeeping

**Evidence:** `src/domain.ts:103-132`, `src/service.ts:209-254`,
`src/app.ts:121-134`, `tests/app.test.ts:61-103`.

- Credit batches track total, issued, retired, available, lifecycle status,
  unit, project, and synthetic/demo flags.
- Issue and retire quantities are validated as positive integer strings.
- Issuance cannot exceed the batch total; retirement cannot exceed available
  issued credits.
- Idempotency keys are scoped by batch and operation type, request-hashed, and
  replayed for the same request.
- Audit events are recorded for batch creation, issuance, and retirement.
- Public endpoints expose local lifecycle state and history.

This is an implemented local registry flow with optional real adapter-backed
settlement. Local quantities are recorded before confirmation; blockchain
records expose `PENDING`, `CONFIRMED`, or `FAILED` so divergence is visible.

### Security middleware and request controls

**Evidence:** `src/app.ts:41-51`, `src/storage.ts:15-21`, `src/service.ts:273-282`.

Implemented controls include Helmet, `x-powered-by` removal, CORS origin
allow-listing, body/upload limits, rate limiting, pino HTTP logs, correlation
IDs, safe storage keys, role checks, request validation, metadata redaction,
and controlled error messages for server errors.

These controls do not by themselves provide TLS, secret management, durable
audit storage, distributed rate limiting, backups, or production deployment
hardening.

## Partial / integration-ready

### Prisma schema and migration readiness

**Evidence:** `prisma/schema.prisma`,
`prisma/migrations/0001_init/migration.sql`, `package.json:19-27`.

Implemented artifacts:

- PostgreSQL datasource and Prisma client generator.
- Initial migration for users, projects, evidence, assessments/findings,
  reviews, credit batches/events, blockchain records, audit events, and
  idempotency records.
- `prisma:generate` and `prisma:migrate` scripts.
- Docker build runs Prisma client generation.

Integration gaps:

- Live PostgreSQL hydration, migration, seed, restart persistence, and
  concurrent mutation behavior were not verified in this environment.
- The Map-compatible adapter queues upserts; the service layer does not yet use
  explicit Prisma interactive transactions for all multi-record business
  operations.
- The runtime `Evidence.isPublic` field is represented in the Prisma model and
  initial migration.
- `prisma/seed.ts` exists and seeds development users, synthetic project and
  evidence metadata, and a synthetic credit batch.

**Audit conclusion:** PostgreSQL persistence is implemented in source and
covered by offline adapter tests, but live database verification remains open.

### Blockchain adapter

**Evidence:** `src/blockchain/index.ts`, `src/blockchain/abi.ts`,
`tests/blockchain.test.ts`, `src/service.ts:225-251`.

The adapter is substantial and has isolated coverage for disabled mode,
configuration validation, safe reads, health, writes, receipt confirmation,
and reverted transactions. It can use viem clients when explicitly created
with an RPC URL, chain ID, contract address, and optional signer.

Integration limitations:

- No live RPC, Anvil node, deployed contract, or receipt was available for an
  end-to-end run.
- Confirmation is awaited in the request; a background retry/reconciliation
  worker is not implemented.
- Credit issuance selects the newest project evidence as the contract evidence
  anchor. A future schema revision should store an explicit evidence reference
  on each credit batch.

**Audit conclusion:** API-to-adapter orchestration is implemented and tested with
fakes; live chain settlement remains unverified.

### Solidity contract workspace

**Evidence:** `contracts/src/CarbonCreditRegistry.sol`,
`contracts/test/CarbonCreditRegistry.t.sol`, `contracts/README.md`,
`contracts/foundry.toml`.

The contract workspace implements role-controlled evidence registration,
evidence-gated issuance, retirement balance checks, operation ID uniqueness,
and pausing. The ABI next to the adapter matches the contract's callable
surface. The contract source targets Solidity `0.8.24`.

The workspace is independent from the API. The repository does not include a
deployment result, deployed address, chain-specific configuration, or a
transaction worker/confirmation pipeline connecting API records to contract
records.

### Docker and local dependency scaffolding

**Evidence:** `Dockerfile`, `docker-compose.yml`, `Makefile`.

- The Dockerfile has build and runtime stages and starts the emitted
  `dist/src/server.js` path.
- Compose defines PostgreSQL 16 and an optional Anvil service.
- Compose does not define the API service.
- The API image does not run migrations or seed data at startup.
- Local filesystem evidence storage is created in the image, but in-memory
  domain records remain ephemeral.

The package `start` script now targets the actual build output
`dist/src/server.js`.

### Frontend integration

**Evidence:** `src/app.ts:45`, `src/config.ts:15`, `src/app.ts:60-73`,
repository file inventory.

The API provides:

- configurable CORS with a default of `http://localhost:5173`;
- bearer-token login and role-aware routes;
- consistent JSON success/error envelopes;
- `/openapi.json` and `/docs` entry points.

No frontend package, source tree, build configuration, or deployed frontend is
present in the repository. A separate frontend can integrate against these
routes, but that integration is not implemented here.

## Not implemented / unverified

### Live PostgreSQL runtime verification

Not verified. The Prisma runtime adapter exists, but `prisma migrate deploy`
returned `P1001` because no PostgreSQL server was reachable at `localhost:5432`.
Run the migration, seed, restart/read-back, and concurrency scenario against a
real isolated PostgreSQL service before production use.

### Sepolia deployment

Not implemented or evidenced. The default chain ID is `31337`; the Compose
Anvil service is local; no Sepolia address, deployment artifact, RPC setup, or
deployment result is in the repository. The manual Foundry deployment example
does not prove a deployment occurred.

### Live blockchain transaction verification

Not verified. The adapter and API orchestration are implemented, but no live RPC,
deployed contract, or confirmed transaction was available.

### Frontend application

Not implemented in this repository. Only backend-facing integration affordances
are present.

### Durable local evidence lifecycle

Not implemented. Evidence bytes use local filesystem storage, evidence delete
returns `501`, and there is no backup, object-store, retention worker, or
cross-instance storage coordination.

### External AI/LLM integration

Not implemented. `AI_PROVIDER` accepts `llm`, but there is no provider client,
prompting, model call, or result persistence in the current source.

### Complete production deployment contract

Not implemented. The repository does not provide a production reverse proxy,
TLS, secret manager, distributed rate limiting, observability backend, or a
verified multi-instance deployment procedure.

## Test and check evidence

### Source-derived test inventory

The current files contain the following test cases/functions:

| Area                 | File                                        | Count derived from source |
| -------------------- | ------------------------------------------- | ------------------------: |
| API                  | `tests/app.test.ts`                         |            2 Vitest tests |
| Verification         | `tests/verification.test.ts`                |           20 Vitest tests |
| Blockchain adapter   | `tests/blockchain.test.ts`                  |            6 Vitest tests |
| Blockchain workflow  | `tests/blockchain-workflow.test.ts`         |            7 Vitest tests |
| Prisma store         | `tests/prisma-store.test.ts`                |            5 Vitest tests |
| Solidity contract    | `contracts/test/CarbonCreditRegistry.t.sol` |    19 `test...` functions |
| **TypeScript total** | `tests/**/*.test.ts`                        |       **35 Vitest tests** |

### Observed checks in this review

| Command                                   | Result observed on October 20, 2026                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run typecheck`                       | Passed.                                                                                |
| `npm run lint`                            | Passed.                                                                                |
| `npm run test` as part of `npm run check` | Passed: 35 of 35 tests across five files.                                              |
| Standalone `npm run build`                | Passed; emitted `dist/src/server.js`.                                                  |
| `npm run prisma:generate`                 | Passed; Prisma emitted a deprecation warning for `package.json#prisma`.                |
| `npm run format:check`                    | Passed after formatting the repository.                                                |
| `contracts/make test`                     | Could not run: `forge` is not installed (`make: forge: No such file or directory`).    |
| `prisma:seed` availability                | Seed script exists; execution requires a reachable PostgreSQL database.                |
| `DATABASE_URL=... npm run prisma:migrate` | Could not complete: Prisma `P1001`, PostgreSQL unavailable at `localhost:5432`.        |
| `npm run audit`                           | Non-zero: 7 advisories remain; fixes require breaking major upgrades in Prisma/Vitest. |

Final observed counts:

```text
TypeScript tests: 35 passed / 0 failed / 35 total
Contract tests:   not run; forge unavailable
Root check:       passed (`npm run check`)
```

The contract test status is intentionally reported as unverified rather than
fabricated.

## Actual API endpoint inventory

Implemented route groups are:

- Health: `/health/live`, `/health/ready`, `/api/v1/health`.
- Auth: `/api/v1/auth/login`, `/api/v1/auth/me`.
- Projects: create/list/detail/patch plus project evidence, assessments, and
  credits lists.
- Evidence: submit, detail, metadata, hash, download, integrity verification,
  public verification, and documented `501` deletion policy.
- Assessments: create/list/detail/findings/report.
- Reviews: queue, create decision, list assessment history, detail.
- Credits: batch create/list/detail, issue, retire, events, local verification,
  public credit detail/history.
- Audit: authorized paginated `/api/v1/audit`.
- Documentation: `/openapi.json`, `/docs`.

All mutations use Zod validation; credit issue/retire requires
`Idempotency-Key`. Public responses omit private document bytes and undisclosed
evidence.

## Database, contract, and environment inventory

The Prisma schema/migration cover `User`, `Project`, `Evidence`, `Assessment`,
`AssessmentFinding`, `Review`, `CreditBatch`, `CreditLifecycleEvent`,
`BlockchainRecord`, `AuditEvent`, and `IdempotencyRecord`, with foreign keys,
indexes, uniqueness constraints, and integer `BIGINT` credit quantities.

The Solidity contract exposes role management, evidence registration and reads,
batch evidence registration, issuance, retirement, balance reads, operation
deduplication, pause/unpause, and role checks. No token transfer or ERC-20
semantics are implemented.

Required secrets/configuration are `JWT_SECRET` in production,
`DATABASE_URL` for Prisma mode, `FILE_STORAGE_ROOT`, and optionally
`BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CHAIN_ID`, `BLOCKCHAIN_CONTRACT_ADDRESS`, and
`BLOCKCHAIN_SIGNER_PRIVATE_KEY` for live chain writes. No values are committed.

## Security findings

| Severity      | Finding                                                                                       | Status / mitigation                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| HIGH          | Default development bootstrap password exists for non-production empty stores.                | Guarded from production bootstrap; replace `DEV_BOOTSTRAP_PASSWORD` and secret management before deployment. |
| HIGH          | Local filesystem evidence has no malware scanning, backup, or object-store durability.        | Documented; production object storage and scanning remain required.                                          |
| MEDIUM        | Prisma Map-compatible persistence is not yet proven under concurrent multi-instance mutation. | Live concurrency testing and interactive transaction hardening remain P1.                                    |
| MEDIUM        | Blockchain signer is configuration-driven and transaction confirmation is request-bound.      | Use a managed signer and background reconciliation worker before production.                                 |
| MEDIUM        | Seven dependency audit advisories remain, including Prisma/Vitest transitive advisories.      | Upgrade review is required; forced major upgrades were not applied blindly.                                  |
| INFORMATIONAL | Database audit rows are not tamper-proof.                                                     | Documented limitation; use append-only/WORM or external audit sink if required.                              |
| INFORMATIONAL | Risk score is not fraud probability or certification.                                         | Explicitly disclosed in API/docs and responses.                                                              |

No critical or known authentication-bypass issue was observed in the local code
review. No independent security audit is claimed.

## Performance and reliability observations

- List endpoints have bounded page sizes where pagination is used.
- Evidence uploads are bounded by `MAX_UPLOAD_SIZE`; bytes are buffered in memory
  by the current multipart adapter.
- Verification is synchronous and deterministic; no external AI call is needed.
- Blockchain confirmation is synchronous per request and needs a worker for
  retries/reconciliation at scale.
- Prisma writes are queued for Map compatibility and need production load and
  transaction tests.
- No destructive external load test or public-network benchmark was run.

## Prioritized remediation checklist

### P0 — before any production or public-chain claim

1. Run migrations, seed, restart/read-back, and concurrency tests against an
   isolated PostgreSQL service.
2. Run Foundry build/tests with an installed `forge` toolchain.
3. Deploy only to a disposable local Anvil or authorized Sepolia account, record
   the actual contract address and receipts, and verify emitted events.
4. Replace development credentials and configure managed secrets/signer custody.

### P1 — before hackathon submission polish

1. Add a background blockchain reconciliation worker and explicit transaction
   intent state machine.
2. Replace local evidence storage with S3-compatible storage plus retention and
   malware scanning.
3. Expand OpenAPI to complete request/response schemas and publish an export.
4. Review and upgrade vulnerable dependencies without unverified breaking
   changes.

### P2 — follow-up hardening

1. Add refresh-token rotation/account management if frontend requirements need it.
2. Add external audit sink, metrics/tracing, and multi-instance rate limiting.
3. Add measured performance benchmarks and database query profiling.

## Readiness assessment

**BACKEND READY WITH DOCUMENTED EXTERNAL LIMITATIONS** for local demonstration
and frontend integration. The core workflow is implemented and verified by 35
passing TypeScript tests, but live PostgreSQL, Foundry, and blockchain network
verification are still external blockers for a stronger production or full
hackathon submission claim.

## Security and operational conclusion

The repository has meaningful prototype controls: JWT verification, bcrypt
hashing, role enforcement, project access checks, reviewer separation of duties,
request validation, rate limiting, Helmet, CORS filtering, upload limits, safe
storage keys, content checks, SHA-256 integrity checks, correlation IDs, and
metadata/log redaction.

The main production risks are optional in-memory mode, local-only evidence bytes,
default development credentials, absent secret management/TLS configuration,
unverified live PostgreSQL/Foundry/blockchain environments, synchronous
blockchain confirmation, and residual dependency audit findings. The accurate
readiness category is **BACKEND READY WITH DOCUMENTED EXTERNAL LIMITATIONS**
for frontend integration and local demonstration, not production deployment.
