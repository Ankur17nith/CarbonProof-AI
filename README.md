# CarbonProof AI — Zero-Trust Environmental Verification Platform

[![Architecture](https://img.shields.io/badge/Architecture-Hexagonal%20%2F%20Clean-2D5A43?style=flat-square)](#b-system-architecture)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square)](#h-comprehensive-test-suite-execution)
[![Tests](https://img.shields.io/badge/Tests-94%20Passing%20(100%25)-success?style=flat-square)](#h-comprehensive-test-suite-execution)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20%2F%205.9-blue?style=flat-square)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square)](https://react.dev)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square)](https://soliditylang.org)
[![Foundry](https://img.shields.io/badge/Foundry-1.8.5-orange?style=flat-square)](https://getfoundry.sh)
[![Vitest](https://img.shields.io/badge/Vitest-5.0.5-729B1B?style=flat-square)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> **Evidence-First Verification, Explainable Risk-Scoring, and Dual-Layer Blockchain Reconciliation for Voluntary Carbon Markets.**

---

## A. Project Identity & Problem Statement

Voluntary carbon markets (VCMs) face a crisis of confidence driven by greenwashing, opaque audit methodologies, duplicate registry claims, and unverifiable baseline adjustments. Traditional registries rely on manual, PDF-bound validation that takes months and leaves market participants unable to verify whether published credits represent authentic environmental custody.

**CarbonProof AI** introduces a zero-trust, deterministic verification architecture that bridges physical evidence documents, automated rule-based risk engines, human reviewer separation of duties, and dual-layer blockchain settlement.

### Ethical Verification Disclaimer
> [!IMPORTANT]
> **Integrity Verification vs. Factual Ground Truth**:  
> Matching SHA-256 cryptographic fingerprints guarantees that retrieved evidence files and metadata payloads are byte-for-byte identical to what was certified at submission. It prevents retro-active file tampering and unauthorized modification. Cryptographic integrity checks do not, on their own, prove that sensor readings or real-world tree biomass measurements are factually accurate without independent sensor custody and accredited on-ground physical inspection.

---

## B. System Architecture

The CarbonProof platform follows a clean hexagonal architecture dividing presentation, deterministic domain logic, cryptographic storage, and settlement adapters.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Presentation Layer (React 18 + Vite)"]
        UI["Web Workspace (Claude-Inspired Editorial UI)"]
        AuthContext["Role-Based Auth Guard (Contributor / Reviewer / Admin)"]
        PublicPortal["Zero-Trust Public Verification Portal"]
    end

    subgraph APILayer ["API Gateway (Express 5 + TypeScript)"]
        Router["REST Endpoints (/api/v1)"]
        RateLimiter["Windowed Rate Limiting & Helmet CSP"]
        AuthMW["JWT Bearer Authentication & RBAC"]
    end

    subgraph CoreEngine ["Deterministic Core Services"]
        ProjectService["Project & Evidence Registry"]
        RulesEngine["Rules Engine (Deterministic v1.0.0 Scorer)"]
        ReviewQueue["Review Workflow (Separation of Duties)"]
        CreditRegistry["Credit Lifecycle (UUIDv4 Idempotent Issuance/Retirement)"]
    end

    subgraph PersistenceLayer ["Persistence & Storage Layer"]
        FileVault["Local Evidence Vault (SHA-256 Content Addressed)"]
        StoreSelector{"Store Selector"}
        MemStore["In-Memory Reactive Store (Fast Dev/Test)"]
        PrismaStore["Prisma ORM (PostgreSQL Production)"]
    end

    subgraph SettlementLayer ["Dual-Layer Blockchain Settlement"]
        ViemAdapter["Viem EVM Adapter"]
        AnvilEVM["EVM Node (Local Anvil / Ethereum / L2)"]
        Contract["CarbonCreditRegistry.sol (OpenZeppelin AccessControl + Pausable)"]
        Reconciliation["Background Reconciliation Worker (Bounded Exponential Retries)"]
    end

    UI -->|HTTPS / REST| Router
    PublicPortal -->|Unauthenticated Public API| Router
    Router --> AuthMW --> CoreEngine
    CoreEngine --> RulesEngine
    CoreEngine --> FileVault
    CoreEngine --> StoreSelector
    StoreSelector -->|USE_IN_MEMORY=true| MemStore
    StoreSelector -->|USE_IN_MEMORY=false| PrismaStore
    CoreEngine --> ViemAdapter
    ViemAdapter --> AnvilEVM
    AnvilEVM --- Contract
    Reconciliation -->|Divergence Polling| ViemAdapter
```

---

## C. Solution & Core Capabilities

| Capability | Module | Verification Status | Implementation Reality |
|---|---|---|---|
| **Editorial Web UI** | `frontend/` | **Verified & Running** | React 18, Tailwind CSS, Claude-inspired warm neutrals, 1-click test roles, WCAG 2.2 AA compliant. |
| **Evidence Vault** | `src/storage.ts` | **Verified & Running** | SHA-256 fingerprinting, binary content-signature validation, multipart upload, one-click hash verification. |
| **Explainable Rules Engine** | `src/verification/` | **Verified & Running** | Deterministic score (0–100), 5 standard rules (additionality, baseline, provenance, leakage, buffer pool), itemized findings. |
| **Separation of Duties** | `src/service.ts` | **Verified & Running** | Developers cannot review their own submissions; Reviewer/Admin approval transitions status with written justification. |
| **Idempotent Credit Batches** | `src/service.ts` | **Verified & Running** | UUIDv4 `Idempotency-Key` headers on issuance and retirement; prevents double-spending and supply drift. |
| **Smart Contract Registry** | `contracts/` | **Verified & Running** | Solidity 0.8.28 with OpenZeppelin `AccessControl` and `Pausable`; 30 Foundry tests with 100% line coverage. |
| **Reconciliation Worker** | `src/blockchain/` | **Verified & Running** | Background divergence detection; bounded retry loops with exponential backoff; updates ledger on confirmed receipts. |
| **Public Lookup Portal** | `frontend/src/features/public/` | **Verified & Running** | Zero-trust public search for projects, evidence SHA-256 hashes, and credit retirement certificates. |

---

## D. Technology Stack

### Frontend Application (`/frontend`)
- **Runtime & UI**: React 18.3.1, TypeScript 5.7.2, Vite 6.4.4
- **Styling**: Tailwind CSS v3.4.16 with Claude-inspired palette tokens (`#FBFBF9`, `#2D5A43`)
- **State & Queries**: TanStack Query v5.62, React Hook Form v7.54, Zod v3.23
- **Icons & Notifications**: Lucide React v0.468, Sonner v1.7.1
- **Testing**: Vitest 5.0.5, React Testing Library 16.1.0, JSDOM 25.0.1

### Backend API (`/src`)
- **Server**: Node.js >=20 <23, Express 5.1.0, TypeScript 5.9.2 (ESM)
- **Security**: Helmet 8.1.0, CORS 2.8.5, express-rate-limit 8.7.1, bcryptjs 3.0.2, jsonwebtoken 9.0.2
- **Logging**: Pino 9.9.4 with correlation IDs (`x-correlation-id`)
- **Persistence**: Dual-mode In-Memory Store and Prisma 6.16.2 / PostgreSQL
- **Blockchain Client**: Viem 2.57.7

### Smart Contracts (`/contracts`)
- **Language**: Solidity 0.8.28
- **Toolchain**: Foundry 1.8.5 (`forge`, `anvil`, `cast`)
- **Dependencies**: OpenZeppelin Contracts v5.1.0 (`AccessControl`, `Pausable`)

---

## E. Prerequisites & Environment Setup

### Required System Tooling
- **Node.js**: `22.x` (LTS recommended, engine pinned to `>=20 <23`)
- **npm**: `>=10.x`
- **Foundry**: Required for smart contract testing and local EVM testnet (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- **Google Chrome**: Optional, for automated screenshot capture

### Backend Configuration (`.env`)
Create `.env` in the repository root (or copy from `.env.example`):

```bash
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
API_PREFIX=/api/v1
DATABASE_URL=postgresql://carbonproof:carbonproof@localhost:5432/carbonproof?schema=public
USE_IN_MEMORY=true
CORS_ALLOWED_ORIGINS=http://localhost:5173
LOG_LEVEL=info
JWT_SECRET=development-only-secret-change-me-please-1234567890
JWT_EXPIRES_IN=15m
FILE_STORAGE_ROOT=./data/storage
MAX_UPLOAD_SIZE=10485760
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
BLOCKCHAIN_ENABLED=false
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
BLOCKCHAIN_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
AI_PROVIDER=local
AI_TIMEOUT_MS=3000
```

---

## F. Installation & Reproducible Startup Procedure

Follow these sequential steps to run the complete stack locally:

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ankurgupta/CarbonProofAI.git
cd CarbonProofAI

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start the Local EVM Testnet (Optional for Blockchain Features)
```bash
# In terminal 1 (starts Anvil on port 8545)
anvil --port 8545 --host 127.0.0.1
```

To compile and test the contracts:
```bash
cd contracts
forge build
forge test -vvv
cd ..
```

### 3. Start the Backend API
```bash
# Starts Express server on http://0.0.0.0:3000 (In-Memory mode by default)
npm run dev
```

Verify backend health:
```bash
curl -s http://127.0.0.1:3000/health/live
# => {"data":{"status":"ok","service":"carbonproof-ai"},...}
```

### 4. Start the Frontend Development Server
```bash
# In terminal 2
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## G. Pre-Seeded Development Test Accounts

When running in development mode (`NODE_ENV=development`), the system automatically provisions seeded accounts:

| Role | Email | Password | Primary Workflow |
|---|---|---|---|
| **Contributor** | `contributor@example.test` | `development-only-password-123` | Submit projects, upload evidence files, request evaluations |
| **Reviewer** | `reviewer@example.test` | `development-only-password-123` | Audit review queue, evaluate findings, approve/reject |
| **Administrator** | `admin@example.test` | `development-only-password-123` | Issue & retire credit batches, inspect immutable audit trail |

*(The login page at `/login` provides 1-click role chips for instant evaluation)*

---

## H. Comprehensive Test Suite Execution

All test suites run with real assertions, zero mocked test suites, and strict coverage:

```bash
# 1. Run root backend tests (41 tests across 7 suites)
npm run test

# 2. Run backend local EVM integration tests
npx vitest run tests/local-evm-integration.test.ts

# 3. Run Foundry Solidity contract tests (30 tests, 100% line coverage)
cd contracts && forge test -vvv && cd ..

# 4. Run frontend tests (23 tests across 5 suites)
cd frontend && npm run test && cd ..

# 5. Run full frontend production build & typecheck
cd frontend && npm run build && cd ..

# 6. Run full root quality checks (typecheck, lint, test, build)
npm run check
```

---

## I. REST API Documentation (`/api/v1`)

The backend automatically hosts an OpenAPI specification at `/openapi.json` and human-readable docs at `/docs`.

### Key Endpoints:
- `POST /api/v1/auth/login`: Authenticate email/password; returns JWT bearer token.
- `GET /api/v1/auth/me`: Retrieve current session identity.
- `GET /api/v1/projects`: Paginated project catalog with status and category filtering.
- `POST /api/v1/projects`: Register a new environmental project draft.
- `POST /api/v1/projects/:id/evidence`: Upload multipart document payload (computes SHA-256 fingerprint).
- `GET /api/v1/evidence/:id/verify`: Verify evidence file integrity against on-chain/ledger hash.
- `POST /api/v1/projects/:id/assessments`: Trigger deterministic rules engine; generates score (0-100) and findings.
- `GET /api/v1/reviews`: Auditor queue for pending submissions (enforces separation of duties).
- `POST /api/v1/reviews/:id/decision`: Record `APPROVE`, `REJECT`, or `REQUEST_CHANGES` with justification.
- `POST /api/v1/projects/:id/credits/batches`: Mint credit batch (requires UUIDv4 `Idempotency-Key`).
- `POST /api/v1/credits/batches/:id/retire`: Burn credits for named beneficiary with certificate serial generation.
- `GET /api/v1/public/projects/:id`: Unauthenticated zero-trust public disclosure.

---

## J. Security, Threat Modeling & Production Hardening

- **Cryptographic File Storage**: Uploaded documents are stored using content-derived filenames. Pre-upload MIME sniffing verifies authentic document signatures (PDF, PNG, JPEG, GeoTIFF, CSV).
- **Idempotency Guarantees**: State-mutating credit endpoints require an `Idempotency-Key` header stored with operation hashes. Duplicate concurrent requests return the existing transaction record rather than double-minting.
- **Role-Based Access Control**: Strict separation between project proponents (`CONTRIBUTOR`) and audit evaluators (`REVIEWER`). Submitting users cannot approve their own projects.
- **Blockchain Key Custody**: Private keys are never exposed in browser or API payloads. Production configurations require cloud KMS / HSM signing (AWS KMS, GCP KMS, or HashiCorp Vault) rather than raw server environment keys.
- **Dependency Audit**: Eliminated critical `tinypool` and `mocker` vulnerabilities by upgrading to Vitest 5.0.5 and React Router 7.18.4.

---

## K. Repository Directory Map

```text
CarbonProofAI/
├── contracts/                  # Solidity smart contracts & Foundry workspace
│   ├── src/                    # CarbonCreditRegistry.sol
│   ├── test/                   # Comprehensive Foundry test suite (30 tests)
│   └── foundry.toml            # Foundry compiler configuration (Solc 0.8.28)
├── docs/                       # Technical documentation and audit reports
│   ├── ARCHITECTURE.md         # System components, data flows, and state machines
│   ├── DEVELOPMENT.md          # Local development guide and environment setup
│   ├── DEPLOYMENT.md           # Production hardening, Kubernetes, and KMS custody
│   ├── SECURITY.md             # Threat modeling, RBAC, and cryptographic guarantees
│   ├── TESTING.md              # Vitest and Foundry testing architecture
│   ├── FINAL_RELEASE_AUDIT.md  # Comprehensive quality gate and security release audit
│   ├── DEMO_SCRIPT.md          # 4-minute time-coded presentation script
│   ├── DEMO_SHOT_LIST.md       # Scene-by-scene camera, transition, and UI focus guide
│   └── DEMO_SETUP.md           # Repeatable demo environment setup guide
├── frontend/                   # React 18 / TypeScript frontend application
│   ├── src/                    # Components, feature modules, and UI primitives
│   ├── public/                 # Brandmark assets and favicon
│   ├── index.html              # HTML shell with Google Inter font
│   └── package.json            # Frontend scripts and dependencies
├── media/                      # Product assets and demonstration media
│   └── demo/                   # Product walkthrough media assets
├── prisma/                     # Database schema and initial PostgreSQL migrations
│   ├── schema.prisma           # Prisma entity definitions
│   └── seed.ts                 # Database seed script
├── src/                        # Express 5 backend API source
│   ├── app.ts                  # Express routes, validation schemas, and error handling
│   ├── auth.ts                 # JWT issuance, password hashing, and role guards
│   ├── config.ts               # Environment validation (Zod)
│   ├── domain.ts               # Domain types, entity interfaces, and serialization
│   ├── repository.ts           # Store abstraction and In-Memory store
│   ├── server.ts               # HTTP server entrypoint
│   ├── service.ts              # Core business services and idempotency
│   ├── storage.ts              # File vault and MIME signature validation
│   ├── blockchain/             # Viem EVM adapter and reconciliation worker
│   └── verification/           # Deterministic rules engine and findings generator
├── tests/                      # Backend Vitest unit and integration suites
└── package.json                # Root package configuration and scripts
```

---

## L. License

This project is open-source software licensed under the [MIT License](LICENSE).

