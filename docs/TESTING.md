# CarbonProof AI — Testing Architecture & Verification Protocols

This document details the test pyramid, testing frameworks, execution procedures, and coverage metrics across the entire CarbonProof AI repository.

---

## 1. Test Pyramid Summary

| Tier | Scope | Framework | Total Tests | Status |
|---|---|---|---|---|
| **Smart Contracts** | Foundry unit & boundary tests | Foundry (`forge test`) | **30 tests** | **100% Passed** |
| **Backend API & Rules** | Unit, domain, service, & auth tests | Vitest (ESM) | **41 tests** | **100% Passed** |
| **Local EVM Integration** | Live Anvil deployment & Viem adapter | Vitest + Anvil | **1 end-to-end suite** | **100% Passed** |
| **Reconciliation Worker** | Polling, bounded retries, divergence | Vitest | **5 tests** | **100% Passed** |
| **Frontend Components** | React UI primitives, formatters, auth, & layouts | Vitest + Testing Library | **23 tests** | **100% Passed** |
| **Production Builds** | Backend & Frontend bundle compilation | TypeScript + Vite | **2 builds** | **100% Passed** |

---

## 2. Smart Contract Tests (`contracts/test/CarbonCreditRegistry.t.sol`)

Run with:
```bash
cd contracts && forge test -vvv && cd ..
```

### Coverage Highlights:
- **Role-Based Access Control**:
  - `testDeploymentGrantsAdminAndOperationalRoles`
  - `testNonAdminCannotGrantRole`
  - `testRoleGrantAndRevocation`
  - `testRoleHolderCanRenounceRole`
  - `testRevokedMinterRoleCannotIssue`
  - `testRevokedEvidenceRoleCannotRegister`
  - `testRevokedPauserCannotPause`
- **Evidence Management**:
  - `testEvidenceRegistrationStoresRecord`
  - `testDuplicateEvidenceIsRejected`
  - `testRegisterEvidenceRejectsZeroIdentifier`
  - `testBatchEvidenceRegistrationStoresAllRecords`
  - `testBatchEvidenceRegistrationRejectsDuplicateAndRollsBack`
  - `testGetEvidenceRejectsUnknownEvidence`
- **Credit Lifecycle & Boundary Conditions**:
  - `testIssuanceRejectsZeroQuantity`
  - `testIssueCreditsRejectsZeroOperationOrProjectId`
  - `testIssuerCanIssueOnlyAgainstRegisteredEvidence`
  - `testRetirementReducesAvailableCredits`
  - `testRetirementRejectsZeroAndExcessQuantity`
  - `testExactBalanceRetirementBoundary`
  - `testMultipleIssuancesAndRetirements`
  - `testOperationIdsAreUniqueAcrossIssuanceAndRetirement`
- **Emergency Pause Controls**:
  - `testPauseStateTransitions`
  - `testPauseBlocksEvidenceIssuanceAndRetirement`
  - `testUnauthorizedPauseAndUnpauseReverts`

---

## 3. Backend Vitest Suites (`tests/`)

Run with:
```bash
npm run test
```

### Suites Tested:
1. `tests/api.test.ts`: Health endpoints, authentication, user signup/login, project CRUD, role restrictions, error schemas.
2. `tests/verification.test.ts`: Deterministic evaluation of additionality, baseline credibility, provenance, leakage, and buffer pool rules.
3. `tests/storage.test.ts`: File storage, SHA-256 fingerprint verification, binary magic number inspection, size limit checks.
4. `tests/blockchain-adapter.test.ts`: Viem adapter interfaces, hash formatting, mocked transaction receipts.
5. `tests/blockchain-reconciliation.test.ts`: Background reconciliation worker, retry loops, transaction confirmation, divergence logging.
6. `tests/blockchain-workflow.test.ts`: End-to-end API credit workflow with blockchain integration.

---

## 4. Local EVM Integration (`tests/local-evm-integration.test.ts`)

Run with:
```bash
npx vitest run tests/local-evm-integration.test.ts
```
Verifies live interaction with Anvil testnet:
- Deploys `CarbonCreditRegistry.sol` to local chain ID `31337`.
- Registers evidence SHA-256 fingerprint on-chain.
- Reads back on-chain evidence record using `getEvidence`.
- Submits idempotent credit issuance and retirement transactions.
- Confirms transaction receipts and emitted on-chain events.

---

## 5. Frontend Vitest Suites (`frontend/src/test/`)

Run with:
```bash
cd frontend && npm run test && cd ..
```

### Suites Tested:
1. `src/test/format.test.ts` (8 tests): Number formatting, BigInt handling, date formatting, SHA-256 ellipsis truncation, badge configurations.
2. `src/test/components.test.tsx` (7 tests): Button loading state, Badge semantic classes, Card layouts, Input ARIA attributes, Select change handling, Modal accessibility.
3. `src/test/auth.test.tsx` (3 tests): Anonymous initialization, sessionStorage persistence, login and logout.
4. `src/test/navigation.test.tsx` (3 tests): Role-based sidebar link filtering, header environment badge.
5. `src/test/features.test.tsx` (2 tests): LoginPage demo chip interaction, PublicVerificationPage search input.

---

## 6. Full Quality Gate Command

To execute all checks in one command:
```bash
npm run check && cd frontend && npm run typecheck && npm run test && npm run build && cd ..
```
