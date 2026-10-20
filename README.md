# CarbonProof AI backend

CarbonProof AI is an evidence-first carbon verification assistance backend. The
repository contains an Express 5 TypeScript API, a deterministic verification
engine, local evidence storage, selectable in-memory or Prisma/PostgreSQL
persistence, a viem blockchain adapter, and an independent Foundry Solidity
workspace.

The API produces verification findings and risk-prioritization signals. It does
not certify a carbon project, establish scientific validity, or replace a
registry, auditor, or other qualified reviewer.

## Current implementation at a glance

| Area            | Current state                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API             | Express 5 with TypeScript and ESM; default prefix `/api/v1`.                                                                                                                               |
| Runtime records | In-memory `Map` collections are the default. Set `USE_IN_MEMORY=false` to hydrate and persist through the Prisma-backed store.                                                             |
| Database        | Prisma schema, migration, seed, and runtime `PrismaStore` are implemented. A reachable PostgreSQL service is required when `USE_IN_MEMORY=false`.                                          |
| Evidence files  | Stored on the local filesystem under `FILE_STORAGE_ROOT`; SHA-256 hashes and basic content-signature checks are implemented.                                                               |
| Verification    | Deterministic, versioned rules with stable finding IDs, configurable rule enablement/weights, severity multipliers, and local explanations.                                                |
| Authentication  | bcryptjs password hashes, JWT bearer tokens, issuer/audience validation, and contributor/reviewer/admin role checks.                                                                       |
| Credit registry | Credit batches and issue/retire events with idempotency keys, persistence support, public verification, and optional blockchain records.                                                   |
| Blockchain      | A tested viem adapter and Solidity workspace are wired into optional evidence/credit workflows. Blockchain is disabled by default and requires a deployed contract plus signer for writes. |
| Frontend        | No frontend application is present in this repository. The API exposes CORS configuration, JSON envelopes, bearer authentication, and a small OpenAPI document for a separate client.      |

See [`docs/BACKEND_FINAL_AUDIT.md`](docs/BACKEND_FINAL_AUDIT.md) for the
implemented, partial, and not-implemented audit.

## Repository layout

```text
src/
  app.ts                  Express routes, middleware, validation, and errors
  server.ts               HTTP server entry point
  auth.ts                 Password hashing, JWTs, and role middleware
  config.ts               Environment parsing and production guards
  repository.ts           Store selection and in-memory store maps
  prisma-store/           Prisma-backed durable store and mappings
  storage.ts              Local file storage and content validation
  service.ts              Project, evidence, assessment, review, credit, and audit services
  verification/           Deterministic verification engine and rules
  blockchain/             Optional viem adapter and contract ABI
tests/                    Vitest API, verification, and adapter tests
prisma/                   PostgreSQL schema and initial migration
contracts/                Independent Foundry Solidity workspace
Dockerfile                Multi-stage API image
docker-compose.yml        PostgreSQL and optional Anvil dependency services
```

## Requirements

- Node.js `22.23.3`, as pinned by [`.nvmrc`](.nvmrc). `package.json` accepts
  Node `>=20 <23`.
- npm with the committed [`package-lock.json`](package-lock.json).
- Foundry only when building or testing the Solidity workspace. Foundry is not
  needed for the TypeScript API tests.

## Install and run locally

From the repository root:

```sh
npm ci
cp .env.example .env
npm run prisma:generate
npm run dev
```

The development server listens on `http://localhost:3000` by default. The
health endpoints are:

- `GET /health/live` — process liveness.
- `GET /health/ready` — local storage and configured dependency status.
- `GET /api/v1/health` — API-prefixed readiness summary.

Development and test app creation bootstraps three in-memory users when the
store is empty and `NODE_ENV` is not `production`:

| Email                      | Role          |
| -------------------------- | ------------- |
| `contributor@example.test` | `CONTRIBUTOR` |
| `reviewer@example.test`    | `REVIEWER`    |
| `admin@example.test`       | `ADMIN`       |

The password is `DEV_BOOTSTRAP_PASSWORD` when set, otherwise the source-level
development fallback `development-only-password-123`. Change it and replace
`JWT_SECRET` for any environment beyond local development. There is no public
user-registration endpoint in the current API.

### Compiled run

```sh
npm run build
node dist/src/server.js
```

The TypeScript compiler emits `src/server.ts` as `dist/src/server.js` because
`tsconfig.json` uses the repository root as `rootDir`. The package `start` script
targets that emitted path.

## API capabilities

All successful JSON responses use the shape `{ "data": ..., "requestId": ... }`.
Validation and other failures use an `error` object with a stable error code,
message, request ID, and validation details when applicable.

### Authentication and authorization

- `POST /api/v1/auth/login` issues a short-lived JWT bearer token.
- `GET /api/v1/auth/me` returns the authenticated user.
- Protected routes use `Authorization: Bearer <token>`.
- Roles are `CONTRIBUTOR`, `REVIEWER`, and `ADMIN`; `PUBLIC` exists in the
  domain types but is not a bootstrapped user role.
- Contributors are limited to their own project data. Reviewers and admins can
  access broader review flows. Reviewers cannot review an assessment they
  created.

### Projects and evidence

- Create, list, read, and patch projects.
- Submit evidence as a multipart file or as JSON-derived content.
- Store evidence locally, record its SHA-256, expose metadata and hashes, and
  download the stored bytes.
- Verify stored content integrity with `MATCH`, `MISMATCH`, or `UNAVAILABLE`.
- Public project views include only evidence marked `isPublic`.
- `DELETE /api/v1/evidence/:id` deliberately returns `501` with a retention
  policy error; evidence deletion is not implemented.

Accepted content checks are deliberately small: PDF files must start with
`%PDF-`, JSON must parse, text/CSV must be non-empty and contain no NUL byte,
and image media types must have non-empty content. Other media types are
rejected by the current validator.

### Assessments and reviews

`POST /api/v1/projects/:id/assessments` runs the deterministic engine against
the selected project evidence. It stores an assessment snapshot and findings,
then exposes assessment detail, findings, reports, and review records.

The default registry is versioned as
`carbonproof-verification-rules@1.0.0` and currently contains these rules:

1. Required evidence missing
2. Project identifier mismatch
3. Reporting-period inconsistency
4. Invalid boundaries
5. Unit mismatch
6. Quantity inconsistency
7. Duplicate evidence hash
8. Duplicate external reference
9. Malformed structured evidence
10. Missing provenance
11. Invalid numeric values
12. Repeated evidence references
13. Contradictory structured claims
14. Credit quantity inconsistency

Findings are normalized and sorted before scoring. The risk score is the sum of
configured rule weights multiplied by severity multipliers, rounded and capped
at 100; `score` is `100 - riskScore`. Risk levels are `LOW` below 34,
`MEDIUM` from 34 through 66, and `HIGH` from 67 upward. These values are
prioritization signals, not probability estimates or certification outcomes.

### Credit registry behavior

The API can create in-memory credit batches, issue and retire quantities, list
events, and expose public batch/history verification. Issue and retire requests
require an `Idempotency-Key`; replaying the same key and request returns the
existing event, while reusing it with a different request is rejected. Quantity
limits and available-balance checks are enforced in the service layer.

With blockchain disabled, the credit flow records an explicit disabled status.
When enabled and configured, the service creates a pending blockchain intent,
submits a real viem transaction, records the transaction hash, confirms the
receipt, and marks the record `CONFIRMED` or `FAILED`. Local quantities remain
authoritative for the prototype and a failed blockchain operation is reported as
a reconciliation condition rather than hidden.

### Public and documentation endpoints

- `GET /api/v1/public/projects/:id`
- `GET /api/v1/public/projects/:id/assessments/latest`
- `GET /api/v1/public/evidence/:id/verify`
- `GET /api/v1/public/credits/:recordId`
- `GET /api/v1/public/credits/:recordId/history`
- `GET /api/v1/credits/verify/:recordId`
- `GET /openapi.json`
- `GET /docs`

The OpenAPI output is intentionally a compact route summary, not a complete
request/response schema catalog.

## Deterministic verification engine

The engine in `src/verification/` is framework-free and does not call an
external AI provider. It validates request shape, sorts evidence by ID, applies
the enabled versioned rules, deduplicates findings, creates stable short-hash
finding IDs, and builds explanations from the finding itself.

Verification can configure required evidence, enabled or disabled rule IDs,
rule weights, severity multipliers, quantity tolerance, and exact versus
contained reporting-period matching. A custom registry or explanation provider
can be supplied by code. The API currently uses the local implementation.

`AI_PROVIDER` accepts `local` or `llm` in configuration, but the current source
contains no LLM client or external model call. `AI_TIMEOUT_MS` is parsed for
configuration compatibility and is not an active model integration.

## Persistence and Prisma readiness

The PostgreSQL schema in [`prisma/schema.prisma`](prisma/schema.prisma) and the
initial SQL migration in
[`prisma/migrations/0001_init/migration.sql`](prisma/migrations/0001_init/migration.sql)
model users, projects, evidence, assessments, findings, reviews, credit
batches/events, blockchain records, audit events, and idempotency records.

The repository also provides `prisma:generate` and `prisma:migrate` scripts.
The runtime persistence mode is selected at app startup:

- `src/repository.ts` selects the in-memory store or `PrismaStore`.
- `src/prisma-store/` constructs `PrismaClient`, hydrates domain collections,
  and queues upserts for Map-shaped service compatibility.
- `USE_IN_MEMORY` defaults to `true`.
- `USE_IN_MEMORY=false` requires a reachable PostgreSQL database and fails
  startup if hydration cannot complete.
- The migration includes the runtime `Evidence.isPublic` field.
- `prisma:seed` seeds development users and synthetic demo records.

The default local mode is intentionally in-memory. For durable records, start
PostgreSQL, apply migrations, seed it, and run with `USE_IN_MEMORY=false`.

## Blockchain and Solidity workspace

`src/blockchain/index.ts` contains:

- `DisabledBlockchainAdapter`, which returns safe disabled read results and
  rejects writes explicitly.
- `ViemBlockchainAdapter`, which validates chain IDs, contract addresses, RPC
  URLs, quantities, bytes32 identifiers, wallet configuration, contract reads,
  transaction hashes, receipts, and confirmations.
- ABI and role constants matching
  [`contracts/src/CarbonCreditRegistry.sol`](contracts/src/CarbonCreditRegistry.sol).

`src/app.ts` constructs the adapter and `src/service.ts` connects evidence and
credit lifecycle requests to it. `BLOCKCHAIN_ENABLED` is `false` by default, and
the default chain ID is local Anvil `31337`. Confirmation is currently awaited
inside the request; a background reconciliation worker remains future work.

The independent Foundry contract workspace uses Solidity `0.8.24` and includes
role-controlled evidence registration, evidence-gated issuance, retirement
balance checks, globally unique operation IDs, and pause behavior. Its local
tests are run from `contracts/` with `forge test` or `make test`.

There is no Sepolia deployment, deployed contract address, chain-specific
deployment script, or API-to-Sepolia wiring in this repository. The generic
`forge create` example in `contracts/README.md` is a manual deployment recipe,
not evidence of a completed deployment.

## Environment

Copy `.env.example` to `.env` for local use. `.env` files and local storage are
ignored by `.gitignore`; never commit credentials or private keys.

| Variable                        | Default / accepted values             | Purpose and current caveat                                                                            |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | `development` / `test` / `production` | Production rejects a development JWT secret and rejects `USE_IN_MEMORY=true`.                         |
| `PORT`                          | `3000`                                | HTTP listen port.                                                                                     |
| `API_PREFIX`                    | `/api/v1`                             | Prefix for API routes.                                                                                |
| `DATABASE_URL`                  | Local PostgreSQL URL                  | Prisma connection used when `USE_IN_MEMORY=false`.                                                    |
| `USE_IN_MEMORY`                 | `true`                                | Selects ephemeral Map storage or the durable Prisma-backed store.                                     |
| `CORS_ALLOWED_ORIGINS`          | `http://localhost:5173`               | Comma-separated allow-list; credentials are disabled.                                                 |
| `LOG_LEVEL`                     | `info`                                | Pino log level.                                                                                       |
| `JWT_SECRET`                    | Development-only placeholder          | Must be at least 32 characters; replace before production.                                            |
| `JWT_EXPIRES_IN`                | `15m`                                 | JWT expiry passed to `jsonwebtoken`.                                                                  |
| `FILE_STORAGE_ROOT`             | `./data/storage`                      | Local evidence byte storage root.                                                                     |
| `MAX_UPLOAD_SIZE`               | `10485760`                            | Maximum request/upload size in bytes; the config caps it at 100 MiB.                                  |
| `RATE_LIMIT_WINDOW_MS`          | `60000`                               | Rate-limit window.                                                                                    |
| `RATE_LIMIT_MAX`                | `120`                                 | Requests per window; `/health/live` is skipped.                                                       |
| `BLOCKCHAIN_ENABLED`            | `false`                               | Enables real adapter-backed registration/issue/retire workflows when contract configuration is valid. |
| `BLOCKCHAIN_RPC_URL`            | `http://127.0.0.1:8545`               | RPC used by the adapter when explicitly constructed and enabled.                                      |
| `BLOCKCHAIN_CHAIN_ID`           | `31337`                               | Default local chain ID.                                                                               |
| `BLOCKCHAIN_CONTRACT_ADDRESS`   | Empty                                 | Required by the adapter when enabled.                                                                 |
| `BLOCKCHAIN_SIGNER_PRIVATE_KEY` | Empty                                 | Optional read-only signer configuration; required for writes. Keep it out of source control.          |
| `AI_PROVIDER`                   | `local` / `llm`                       | Only local deterministic behavior is implemented.                                                     |
| `AI_TIMEOUT_MS`                 | `3000`                                | Parsed configuration value; no active LLM call uses it.                                               |
| `DEV_BOOTSTRAP_PASSWORD`        | Unset                                 | Optional non-production password for the three bootstrapped users.                                    |

## Checks and test inventory

The root commands are defined in `package.json` and wrapped by the root
`Makefile`:

```sh
make test       # npm run test, Vitest
make check      # typecheck, lint, test, then build
npm run build
npm run format:check
npm run prisma:generate
```

The source currently contains 35 Vitest tests:

- 2 API flow/auth tests in `tests/app.test.ts`.
- 20 deterministic verification tests in `tests/verification.test.ts`.
- 6 blockchain adapter tests in `tests/blockchain.test.ts`.
- 7 API-to-blockchain workflow tests in `tests/blockchain-workflow.test.ts`.
- 5 Prisma store/mapping tests in `tests/prisma-store.test.ts`.

The contract file contains 19 Foundry test functions. They require `forge`.

Observed in the current repository environment on October 20, 2026:

- `npm run typecheck` passed.
- `npm run lint` passed.
- A standalone `npm run build` passed and emitted `dist/src/server.js`.
- `npm run prisma:generate` passed with Prisma's configuration deprecation
  warning.
- `npm run check` passed: 35 tests passed across five files.
- `npm run format:check` passed.
- `npm run audit` remains non-zero with 7 dependency advisories; see the final
  audit for the exact remaining advisories and upgrade tradeoffs.
- `contracts/make test` could not run because `forge` is not installed in the
  current environment.

These are repository observations, not claims that the full check suite is
green.

## Docker and deployment

Build and run the API image for a local or prototype deployment:

```sh
docker build -t carbonproof-ai-backend .
docker run --rm --env-file .env -p 3000:3000 carbonproof-ai-backend
```

The multi-stage [`Dockerfile`](Dockerfile) uses Node 22, runs `npm ci`, runs
Prisma client generation, compiles TypeScript, creates `/app/data/storage`, and
starts `node dist/src/server.js`.

[`docker-compose.yml`](docker-compose.yml) defines a PostgreSQL 16 service and
an Anvil service under the `blockchain` profile. It does not define an API
service. Start PostgreSQL, run migrations/seed, then start the API separately
with `USE_IN_MEMORY=false` for durable local operation.

Before any real deployment, the project still needs object storage, production
secret management, operational TLS/reverse-proxy configuration, distributed
rate limiting, a background blockchain reconciliation worker, and a professional
security review.

## Security notes

Implemented controls include Helmet, CORS origin filtering, request size
limits, rate limiting, bcrypt password hashing, JWT issuer/audience checks,
role-based authorization, project access checks, reviewer separation of duties,
safe local storage keys, filename sanitization for downloads, MIME/content
checks, SHA-256 integrity checks, request correlation IDs, audit events, and
redaction of selected audit metadata and log headers.

Operational limitations remain:

- Development credentials and a development JWT fallback exist in source for
  non-production bootstrap behavior; replace them before deployment.
- In-memory mode is process-local; PostgreSQL mode persists domain records, but
  the current Prisma Map-compatible adapter still needs production concurrency
  testing and explicit transaction hardening.
- Evidence bytes are local filesystem files, not object storage with a backup,
  retention, or access-management policy.
- PostgreSQL audit persistence is implemented in the Prisma store, but the audit
  table is not tamper-proof.
- Blockchain private-key handling is configuration-level and must be replaced by
  a managed signer or vault for production.
- The API does not provide TLS, secret management, or a production reverse
  proxy configuration.
- Risk output is a verification-assistance signal, not a claim of project
  legitimacy or carbon-credit validity.
