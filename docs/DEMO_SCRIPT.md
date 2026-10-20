# CarbonProof AI — Platform Demonstration Script

**Domain**: Carbon Markets & Emissions Transparency  
**Target Duration**: 03:09  
**Tone**: Authoritative, concise, technical, calm, editorial  
**Voice Profile**: `en-US-ChristopherNeural` (Clear, professional cadence)

---

## Time-Coded Narration & Scene Script

### Scene 1: Problem Statement & Product Overview (0:00 – 0:35)
- **Visual**: CarbonProof AI Landing / Overview Dashboard (`http://localhost:5173/`).
- **On-Screen Action**: Camera pans across the warm neutral interface, highlighting aggregated verified vs. retired credits, live verification status indicator, and the synthetic demo disclosure badge.
- **Narration**:
  > *"Voluntary carbon markets face an existential trust problem. Today, credit verification relies on static, disconnected PDF audit reports that take months to review, invite double-counting, and obscure baseline calculations. CarbonProof AI introduces a zero-trust, deterministic verification platform. We bridge physical evidence documents, explainable automated risk scoring, strict separation of audit duties, and dual-layer blockchain reconciliation."*

---

### Scene 2: Environmental Project Explorer & Data Intake (0:35 – 1:05)
- **Visual**: Project Explorer catalog (`/projects`) and Project Detail workspace (`/projects/:id`).
- **On-Screen Action**: Filter projects by methodology ('Afforestation / Reforestation') and select 'Kasigau Corridor REDD+ Project'. Show project parameters, geographic coordinates, and active lifecycle stage.
- **Narration**:
  > *"Here in the Project Explorer, every environmental initiative is cataloged with structured metadata: methodology standards, crediting periods, geographic coordinates, and registry references. Rather than accepting high-level claims, CarbonProof AI treats every carbon credit assertion as an unverified hypothesis until backed by immutable evidence."*

---

### Scene 3: Cryptographic Evidence Vault & Integrity Check (1:05 – 1:45)
- **Visual**: Evidence Vault (`/evidence`).
- **On-Screen Action**: Click on an evidence document (Satellite Canopy LiDAR Survey). Display the computed SHA-256 fingerprint. Click the 'Verify Record' button showing instant match against the immutable ledger.
- **Narration**:
  > *"Under the Evidence Vault, raw documentation—remote sensing GeoTIFFs, ground biomass sensor logs, and baseline additionality spreadsheets—are cryptographically fingerprinted using SHA-256. Notice our critical ethical distinction: matching cryptographic fingerprints proves byte-for-byte immutability, ensuring documents cannot be retroactively altered after submission. It establishes verifiable custody without making false claims of replacing on-ground physical inspection."*

---

### Scene 4: Explainable Deterministic Risk Assessments (1:45 – 2:25)
- **Visual**: Risk Assessments interface (`/assessments`).
- **On-Screen Action**: Open an assessment report showing overall Risk Score (72/100, Moderate Risk). Expand itemized rules: Additionality Hurdle, Baseline Deforestation Credibility, Provenance Attachment, and Leakage Mitigation.
- **Narration**:
  > *"Next, our deterministic rules engine evaluates submitted projects against standardized carbon accounting criteria. Unlike black-box neural networks, CarbonProof's scoring is completely transparent and reproducible. Reviewers see the exact rule IDs evaluated, severity ratings from Low to Critical, and actionable remediation recommendations. An auditor knows precisely why a score was assigned and what adjustments are required."*

---

### Scene 5: Reviewer Queue & Separation of Duties (2:25 – 3:00)
- **Visual**: Review Queue (`/reviews`).
- **On-Screen Action**: Log in as an accredited Reviewer. Open a pending project audit. Show the disabled approval button for self-authored projects. Demonstrate entering audit findings and recording an official approval decision.
- **Narration**:
  > *"Integrity requires governance. Our platform enforces strict separation of duties: project developers are prohibited from reviewing or approving their own submissions. Accredited reviewers inspect findings, review evidence integrity, and record binding audit decisions accompanied by cryptographically signed justifications."*

---

### Scene 6: Credit Registry & Dual-Layer Blockchain Settlement (3:00 – 3:35)
- **Visual**: Credit Registry (`/credits`).
- **On-Screen Action**: Open the Credit Batches view. Show available vs. retired quantities. Demonstrate credit retirement for a corporate beneficiary. Show the resulting Anvil EVM transaction hash and event confirmation.
- **Narration**:
  > *"Once approved, credit batches are minted with mandatory UUID idempotency keys to eliminate double-issuance risks across network retries. When credits are retired, an on-chain event burns the tokens on our Solidity registry contract while recording a unique retirement serial certificate. A background reconciliation worker continuously polls the EVM node, resolving divergences and ensuring off-chain ledgers mirror on-chain finality."*

---

### Scene 7: Public Verification Portal & Closing (3:35 – 3:55)
- **Visual**: Public Verification Portal (`/public`).
- **On-Screen Action**: Enter an evidence SHA-256 hash in the unauthenticated public portal. Display the instant public certificate verifying the proof.
- **Narration**:
  > *"Finally, any market participant, corporate buyer, or regulator can verify project legitimacy through our unauthenticated public portal using a project UUID or evidence hash. CarbonProof AI delivers transparency without greenwashing, providing the cryptographic rigor voluntary carbon markets urgently need."*
