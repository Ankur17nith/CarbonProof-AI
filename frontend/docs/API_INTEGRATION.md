# CarbonProof AI — Backend API Integration Reference

This document describes how the CarbonProof frontend integrates with the backend REST endpoints (`/api/v1`), including authentication, error handling, file uploads, and idempotency guarantees.

---

## 1. Client Architecture (`src/lib/api.ts`)

The frontend uses a lightweight, fully-typed fetch client wrapper that handles:
- Base URL prefixing (`/api/v1`) with transparent proxying during local development via Vite (`http://localhost:3000`).
- Automatic `Authorization: Bearer <token>` injection for authenticated requests.
- Automatic `Content-Type: application/json` header injection for JSON payloads (while intentionally omitting `Content-Type` for `FormData` to allow the browser to calculate multipart boundary headers).
- Unhandled HTTP 401 response interception that automatically clears tokens and redirects to `/login`.
- Strongly typed responses using TypeScript generics.

```typescript
import { api } from '@/lib/api';

// Example: Fetch paginated project list
const data = await api.get<PaginatedResponse<Project>>('projects?page=1&limit=20');

// Example: Submit credit issuance with idempotency key
const result = await api.post<CreditBatch>(
  `projects/${projectId}/credits/batches`,
  { quantity: '10000', vintageYear: 2025 },
  { headers: { 'Idempotency-Key': crypto.randomUUID() } }
);
```

---

## 2. Integrated Endpoints & Capabilities

### Authentication (`/auth`)
- `POST /auth/login`: Authenticates user credentials and returns JWT bearer token + User profile.
- `GET /auth/me`: Retrieves current session profile to re-verify token validity on reload.

### Projects (`/projects`)
- `GET /projects`: Paginated listing with filtering by status, category, country, registry, and text query.
- `GET /projects/:id`: Full project disclosure including risk score, evidence count, and credit batch summaries.
- `POST /projects`: Create a new project draft.
- `POST /projects/:id/submit`: Submit draft for verification.

### Evidence Vault (`/evidence` & `/projects/:id/evidence`)
- `GET /evidence`: Paginated evidence listing across projects.
- `POST /projects/:id/evidence/upload`: Multipart file upload. Computes and checks SHA-256 fingerprint on backend.
- `GET /evidence/:id/verify`: Checks file integrity against recorded SHA-256 hash.
- `GET /evidence/:id/download`: Retrieves stored evidence file.

### Risk Assessments (`/assessments` & `/projects/:id/assessments`)
- `POST /projects/:id/assessments/run`: Executes the deterministic verification rules engine and records an explainable assessment score (0-100) with rule findings.
- `GET /assessments/:id`: Retrieves itemized rules evaluated, severity ratings (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and remediation recommendations.

### Review Queue (`/reviews`)
- `GET /reviews`: Lists pending reviews filtered by assignment status.
- `POST /reviews/:id/decision`: Submits audit decision (`APPROVE`, `REJECT`, `REQUEST_CHANGES`) with justification. Enforces separation of duties (authors cannot approve their own projects).

### Credit Registry & Blockchain Settlement (`/credits`)
- `GET /credits/batches`: Lists issued credit batches with available and retired balances.
- `POST /projects/:id/credits/batches`: Issues a new credit batch with mandatory `Idempotency-Key` header.
- `POST /credits/batches/:id/retire`: Retires credits for a beneficiary with certificate generation and mandatory `Idempotency-Key`.
- `GET /credits/batches/:id/events`: Retrieves lifecycle events including on-chain transaction hash and confirmation status.

### Audit Log (`/audit`)
- `GET /audit`: Immutable audit log query with pagination, entity filtering, and action filtering (Admin only).

### Public Verification Portal (`/public`)
- `GET /public/projects/:id`: Zero-trust project disclosure (no authentication required).
- `GET /public/evidence/:id/verify`: Public cryptographic hash verification.
- `GET /public/credits/:id`: Public credit certificate settlement proof.

---

## 3. Idempotency Guarantees
All state-mutating credit operations (`/credits/batches`, `/credits/batches/:id/retire`) require an `Idempotency-Key` header. The frontend automatically generates a UUIDv4 on submission and stores it during network retries to guarantee that network hiccups never cause double issuance or double retirement.
