# CarbonProof AI backend final audit

**Review date:** October 20, 2026  
**Scope:** repository files under `src/`, `tests/`, `prisma/`, `contracts/`,
root build/configuration files, and the current test commands.  
This report records the final local implementation, verification, and remediation checks
executed in this workspace.

Status labels mean:

- **Implemented & Verified** — behavior is present in source, verified with real tools and passing tests.
- **Partial / integration-ready** — useful artifacts or isolated behavior exist, but external environment requirements remain.
- **Not implemented / unverified** — the repository has no working implementation or the required service was unreachable.

## Executive status

The repository contains an Express TypeScript API with a deterministic
verification core, JWT authentication, local evidence storage, selectable
in-memory or Prisma-backed persistence, credit lifecycle bookkeeping, a viem
blockchain adapter, a background blockchain reconciliation worker, and an
independent Solidity contract workspace.

All TypeScript checks are green: **41 of 41 Vitest tests pass across seven test files**,
and typecheck, lint, build, and Prettier formatting checks pass with zero errors.

Solidity smart contracts and local EVM integration are fully verified:

- Foundry toolchain (`forge`, `anvil`, `cast` v1.8.5) was installed.
- **30 of 30 Solidity tests pass** in `CarbonCreditRegistry.t.sol` with **100% line coverage** and **100% function coverage**.
- Anvil local node (Chain ID `31337`) was started and `CarbonCreditRegistry` was deployed at `0x5FbDB2315678afecb367f032d93F642f64180aa3` (Tx: `0xaa7453ba20dcbfe62674120abe68136697c5ad08ed29c4984a21a9b94b7a4949`).
- Live end-to-end integration was executed and verified (`tests/local-evm-integration.test.ts`), covering evidence registration, contract reads, credit issuance, confirmation, idempotent replay, and duplicate rejection.

A background **Blockchain Reconciliation Worker** (`src/blockchain/reconciliation.ts`) was implemented and tested (`tests/blockchain-reconciliation.test.ts`), supporting safe receipt polling, bounded retries with exponential backoff, persistent retry state, structured logging without private keys, and on-chain divergence detection.

Dependency remediation upgraded Vitest to `v5.0.5`, successfully resolving both critical prototype-pollution/RCE advisories in `tinypool` and the moderate advisory in `@vitest/mocker`. Total advisories dropped from 7 to 4 (all dev-only transitive dependencies of the Prisma CLI). The Prisma deprecation warning in `package.json` was resolved by introducing `prisma.config.ts`.

PostgreSQL persistence remains unverified against a live database because Docker daemon permissions (`/var/run/docker.sock`) are restricted for the current user and no host PostgreSQL instance is listening on port 5432.

---

## Verification and Remediation Comparison

| Area                      | Prior Status (Oct 20, 2026)    | Post-Remediation Status    | Notes / Evidence                                       |
| :------------------------ | :----------------------------- | :------------------------- | :----------------------------------------------------- |
| **TypeScript Tests**      | 35 passed (5 files)            | **41 passed (7 files)**    | Added local EVM & reconciliation test suites           |
| **Solidity Tests**        | Unverified (`forge` missing)   | **30 passed (0 failed)**   | Foundry v1.8.5 installed; 100% line coverage           |
| **Local EVM Integration** | Unverified (no Anvil / deploy) | **Verified on Anvil**      | Contract deployed at `0x5FbDB...`; live API tests pass |
| **Blockchain Worker**     | Unimplemented                  | **Implemented & Verified** | `BlockchainReconciliationWorker` with 5 tests          |
| **Dependency Advisories** | 7 (2 critical, 4 high, 1 mod)  | **4 high remaining**       | Fixed 2 critical (tinypool) & 1 moderate (vitest)      |
| **Prisma Config Warning** | Emitted deprecation warning    | **Resolved**               | Migrated to `prisma.config.ts`                         |
| **PostgreSQL Runtime**    | Unavailable                    | Unavailable                | User lacks Docker socket permissions                   |

---

## Detailed Findings and Remediation

### 1. Dependency Security Remediation

- **Advisories Resolved:**
  - `GHSA-5gmw-xhrv-c9v3` (Critical, Prototype Pollution in `tinypool` <= 2.1.0). Resolved by upgrading `vitest` to `^5.0.5`.
  - `GHSA-85c8-ppgw-ccpr` (Critical, Prototype Pollution Gadget to RCE in `tinypool` < 2.1.2). Resolved by upgrading `vitest` to `^5.0.5`.
  - `GHSA-82fw-gwwq-j7x9` (Moderate, Arbitrary File Read in `@vitest/mocker` < 4.1.11). Resolved by upgrading `vitest` to `^5.0.5`.

- **Advisories Remaining (4 High):**
  - `deepmerge-ts` (< 8.0.0, GHSA-ggr8-5vv4-36mx)
  - `effect` (< 3.20.0, GHSA-38f7-945m-qr2g)
  - `@prisma/config` (transitive through Prisma CLI)
  - `prisma` (transitive CLI package)
  - **Reason open:** These advisories affect only the `prisma` development CLI tooling (`node_modules/prisma`), not the production runtime `@prisma/client`. Fixing requires upgrading to Prisma 7 (`prisma@7.10.1`), which is an invasive breaking change that deprecates `prisma-client-js`, removes direct connection URLs in schema, and requires database adapter refactoring. In accordance with audit instructions, breaking major changes were not forced blindly.

### 2. Smart Contract Validation (Foundry)

- **Toolchain:** Installed Foundry 1.8.5 via official `foundryup`.
- **Source:** `contracts/src/CarbonCreditRegistry.sol`
- **Tests:** `contracts/test/CarbonCreditRegistry.t.sol`
- **Test execution:** `forge test -vvv` passes 30 tests in 5.45ms.
- **Coverage metrics (`forge coverage`):**
  - **Lines:** 100.00% (100/100)
  - **Statements:** 98.95% (94/95)
  - **Branches:** 95.00% (19/20)
  - **Functions:** 100.00% (25/25)
- **Tests added:**
  - `testUnauthorizedIssuanceReverts`
  - `testUnauthorizedRetirementReverts`
  - `testUnauthorizedPauseAndUnpauseReverts`
  - `testPauseStateTransitions`
  - `testRegisterEvidenceRejectsZeroIdentifier`
  - `testIssueCreditsRejectsZeroOperationOrProjectId`
  - `testRetireCreditsRejectsZeroOperationOrProjectId`
  - `testBatchEvidenceRegistrationRejectsEmptyBatch`
  - `testGetEvidenceRejectsUnknownEvidence`
  - `testExactBalanceRetirementBoundary`
  - `testMultipleIssuancesAndRetirements`
- **Bug fix in test suite:** Resolved `vm.prank` consumption bug where nested argument evaluations consumed call pranks prematurely.

### 3. Local EVM Integration

- **Local Chain:** Anvil 1.8.5 running on `http://127.0.0.1:8545` (Chain ID `31337`).
- **Deployed Contract:** `CarbonCreditRegistry`
  - **Address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
  - **Deployer / Admin:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  - **Transaction Hash:** `0xaa7453ba20dcbfe62674120abe68136697c5ad08ed29c4984a21a9b94b7a4949`
- **Automated Verification Suite:** `tests/local-evm-integration.test.ts`
  1. Evidence fingerprint registered via API and mined in block on Anvil.
  2. Evidence read back directly from contract; verified URI, submitter address, and SHA-256 content hash.
  3. Credit batch created; valid issuance submitted and confirmed on-chain.
  4. Mined transaction receipt confirmed block number and gas usage.
  5. In-database record transitioned from `PENDING` to `CONFIRMED`.
  6. Idempotent API replay tested: repeated request returned HTTP 201 with `replayed: true` without creating duplicate on-chain transactions.
  7. Duplicate on-chain operation rejected: direct submission with used `operationId` reverted with `DuplicateOperationId`.
  8. Credit retirement executed and confirmed on-chain.
  9. Excess retirement rejected with HTTP 409 `INSUFFICIENT_AVAILABLE_CREDITS`.
  10. Persisted transaction history verified across operations.

### 4. Blockchain Reconciliation Worker

- **Implementation:** `src/blockchain/reconciliation.ts` (`BlockchainReconciliationWorker`)
- **Capabilities:**
  - **Idempotent processing:** Safe to run repeatedly; tracks per-record state.
  - **Receipt polling:** For records with `transactionHash`, polls receipt; updates record to `CONFIRMED` or `FAILED`.
  - **Missing hash recovery:** If transaction intent was logged but process died before hash was recorded, queries contract state (`evidenceExists` / `operationUsed`). If present on-chain, marks `CONFIRMED` without resubmitting.
  - **Bounded retries & backoff:** Exponential backoff with configurable max attempts.
  - **Divergence detection:** Detects when database marks an operation confirmed but on-chain query returns false; produces structured `DivergenceReport`.
  - **Safe logging:** Uses structured logger; strictly omits private keys or sensitive payloads.
- **Test Suite:** `tests/blockchain-reconciliation.test.ts` (5 tests, all passing).

### 5. Prisma Configuration Deprecation

- **Issue:** Prisma emitted `warn The configuration property package.json#prisma is deprecated and will be removed in Prisma 7`.
- **Resolution:**
  - Created `prisma.config.ts` using `defineConfig` exported by `@prisma/config` / `prisma/config`.
  - Removed deprecated `"prisma"` block from `package.json`.
  - Updated `tsconfig.json` to include `prisma.config.ts`.
  - `npm run check` and `npm run typecheck` pass with zero warnings.

### 6. PostgreSQL Environment Status

- **Check performed:** Checked `psql`, `pg_isready`, and Docker access.
- **Result:** PostgreSQL is not running locally on port 5432. Docker daemon is installed, but the current user does not have permission to connect to `/var/run/docker.sock` (`permission denied`).
- **Conclusion:** As instructed, database tests are not fabricated. PostgreSQL migration and persistence tests require host Docker permissions or an accessible PostgreSQL server at `DATABASE_URL`.

---

## Test Inventory Summary

| Area                      | Test File                                   | Test Count | Status         |
| :------------------------ | :------------------------------------------ | :--------: | :------------- |
| API                       | `tests/app.test.ts`                         |     2      | Passed         |
| Verification Engine       | `tests/verification.test.ts`                |     20     | Passed         |
| Blockchain Adapter        | `tests/blockchain.test.ts`                  |     6      | Passed         |
| Blockchain Workflow       | `tests/blockchain-workflow.test.ts`         |     2      | Passed         |
| Local EVM Integration     | `tests/local-evm-integration.test.ts`       |     1      | Passed         |
| Blockchain Reconciliation | `tests/blockchain-reconciliation.test.ts`   |     5      | Passed         |
| Prisma Store (Unit)       | `tests/prisma-store.test.ts`                |     5      | Passed         |
| **TypeScript Total**      | `tests/**/*.test.ts`                        |   **41**   | **All Passed** |
| Solidity Contract         | `contracts/test/CarbonCreditRegistry.t.sol` |   **30**   | **All Passed** |
| **Combined Total**        |                                             |   **71**   | **All Passed** |

---

## Readiness Assessment

**BACKEND READY FOR FRONTEND INTEGRATION AND LOCAL DEMONSTRATION**

The core backend workflows, verification engine, smart contracts, local EVM integration, and reconciliation pipeline are fully functional, typed, and verified with 71 automated tests.
Remaining items for production deployment:

1. Live PostgreSQL hosting (grant docker group permissions or provision managed PostgreSQL).
2. S3/GCS object storage replacing local filesystem storage.
3. KMS/Vault secret manager for signer private keys.
