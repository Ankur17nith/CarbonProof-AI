# CarbonProof AI — Security Architecture & Threat Model

This document outlines the security architecture, threat model, authentication controls, cryptographic integrity guarantees, and operational limits of CarbonProof AI.

---

## 1. Threat Modeling & Mitigation Matrix

| Threat Category | Potential Risk | Mitigation Mechanism in CarbonProof AI |
|---|---|---|
| **Retroactive Document Alteration** | Proponents change evidence documents after certification to hide non-compliance. | Uploaded documents are immediately SHA-256 fingerprinted and anchored in the off-chain ledger and optional on-chain EVM contract (`registerEvidence`). Any subsequent byte change causes verification failure. |
| **Self-Approval / Fraudulent Certification** | Malicious project developers approve their own projects or inflate credits. | Strict separation of duties in `src/service.ts`: users with `CONTRIBUTOR` cannot access the Review Queue; `POST /reviews/:id/decision` prohibits project creators from reviewing their own submissions. |
| **Double-Minting / Supply Drift** | Network timeouts or concurrent retries cause double credit batch issuance or double retirement. | Mandatory UUIDv4 `Idempotency-Key` headers on all state-mutating credit endpoints. Operation hashes are recorded; repeated submissions return the existing receipt. |
| **Over-Retirement / Balance Inversion** | Concurrent retirement calls attempt to burn more credits than currently available. | Strict balance assertions (`availableQuantity >= requestedQuantity`) in `src/service.ts` and in `CarbonCreditRegistry.sol` (`require(batch.availableQuantity >= quantity)`). |
| **Malicious File Uploads** | Attackers upload executables disguised as PDFs or documents. | Pre-upload binary signature validation (`storage.ts`) checks magic bytes for valid document formats (PDF, PNG, JPEG, GeoTIFF, CSV); strict file size cap (`MAX_UPLOAD_SIZE`, 10MB default). |
| **Brute-Force & Denial of Service** | Password guessing or endpoint flooding. | Windowed IP rate limiting (`express-rate-limit`: 120 req/min default); bcryptjs password salting (cost factor 12); Helmet CSP headers. |
| **Credential & Secret Leakage** | Leaking signing keys or tokens in logs or client bundles. | Pino logger redacts `Authorization` and `Cookie` headers; Vite client bundle contains zero server environment secrets; production runtime guards prohibit default development secrets. |

---

## 2. Cryptographic Integrity vs. Ground Truth

> [!CAUTION]
> **Scope of Cryptographic Verification**:  
> A successful hash match certifies that a digital file has not been altered or tampered with since its registration timestamp. It does **not** independently prove that the real-world biomass measurements, satellite interpretations, or baseline assertions inside the document are scientifically valid or true. Ground-truth validation requires accredited third-party validation and verification bodies (VVBs) and tamper-resistant IoT custody.

---

## 3. Smart Contract Security Controls (`CarbonCreditRegistry.sol`)

- **OpenZeppelin AccessControl**:
  - `DEFAULT_ADMIN_ROLE`: High-level governance, role grant/revoke permissions.
  - `EVIDENCE_ROLE`: Authorized to record SHA-256 evidence fingerprints.
  - `MINTER_ROLE`: Authorized to issue credit batches.
  - `RETIREMENT_ROLE`: Authorized to retire credits.
  - `PAUSER_ROLE`: Emergency pause capability stopping all mutations in case of anomaly.
- **Pausable Pattern**: Critical state-mutating functions (`registerEvidence`, `issueCredits`, `retireCredits`) are protected with `whenNotPaused`.
- **Zero-Value & Replay Guards**:
  - Rejects zero quantities and zero-address recipients.
  - Rejects duplicate evidence hashes (`EvidenceAlreadyRegistered`).
  - Rejects duplicate operation IDs (`OperationAlreadyExists`).
- **Comprehensive Foundry Coverage**: 30 tests covering boundary conditions, role revocation, pause transitions, and supply overflows with 100% line coverage.

---

## 4. Production Operational Recommendations

1. **Key Custody**: Transition from environment private keys to AWS KMS / GCP KMS HSM-backed signers.
2. **PostgreSQL Multi-AZ**: Deploy PostgreSQL with multi-availability-zone replication and encrypted storage.
3. **WORM Object Storage**: Store uploaded evidence in AWS S3 with Object Lock enabled for regulatory-compliant immutability.
4. **Regular Dependency Audits**: Maintain automated dependency scanning in CI/CD pipeline to remediate newly discovered CVEs.
