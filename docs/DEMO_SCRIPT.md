# CarbonProof AI — Platform Demonstration Script

**Domain**: Carbon Markets & Emissions Transparency  
**Target Duration**: 05:07 (307.7 seconds)  
**Tone**: Authoritative, concise, technical, calm, editorial  
**Voice Profile**: `en-US-ChristopherNeural` (Clear, professional cadence)  
**Subtitles**: Permanently burned-in on video frames + embedded `mov_text` subtitle track  

---

## Time-Coded Narration & Scene Script

### Scene 1: Sign In & Authenticated Dashboard (`00:00 - 00:31`)
- **Visual**: CarbonProof AI Login (`/login`) and Overview Dashboard (`/`).
- **On-Screen Action**: Visual cursor clicks the 1-click Administrator chip (`admin@example.test`), autofilling credentials. Submits sign in. Dashboard renders aggregate metrics: Total Projects, Verified Carbon Credits, and Dual-Layer EVM settlement indicators. Smooth scroll down across Verification Stream and system status.
- **Narration**:
  > *"Welcome to CarbonProof AI, an evidence-first environmental verification platform engineered to restore cryptographic integrity to voluntary carbon markets. We begin by authenticating into the platform using the administrator role. On the main dashboard, market operators and auditors have immediate visibility into aggregate system metrics: total active projects, verified carbon credits, and dual-layer settlement indicators. Every metric is backed by verified data records."*

---

### Scene 2: Project Creation & Parameter Registration (`00:31 - 01:03`)
- **Visual**: Project Explorer (`/projects`) and Project Detail Workspace (`/projects/:id`).
- **On-Screen Action**: Visual cursor clicks "+ Register Project" button. Project creation modal opens. Realistic parameters populated: "Mount Kenya Native Reforestation & Agroforestry Project", methodology VM0007 (VCS ARR), region Kenya Central Highlands, registry reference VCS-2849. Submits form via `POST /api/v1/projects`. Project created in `DRAFT` status and opened in Project Detail workspace.
- **Narration**:
  > *"Next, we register a new environmental carbon project through the platform's intake interface. We enter the project details: the Mount Kenya Native Reforestation and Agroforestry Project, adopting the verified VM0007 methodology. We specify the host region in Kenya's Central Highlands, register the external registry reference, and submit. The project is created through our REST API and initialized in draft status, ready for primary evidence intake."*

---

### Scene 3: Actual Project Document Uploads (`01:03 - 01:48`)
- **Visual**: Evidence Intake Modal on Project Detail workspace.
- **On-Screen Action**: Visual cursor clicks "+ Upload Evidence". Uploads three authentic, readable demonstration documents sequentially:
  1. `mount_kenya_pdd_v1.2.pdf`: Project Design Document with additionality barrier analysis (PDF).
  2. `forest_biomass_inventory.csv`: Plot sample measurements with allometric biomass formulas (CSV).
  3. `remote_sensing_canopy_metrics.json`: Satellite LiDAR canopy height telemetry and Sentinel-2 NDVI timeseries (JSON).
  Each file is uploaded through real multipart requests (`POST /api/v1/projects/:id/evidence`) and appears in the project evidence table with computed SHA-256 fingerprints, file sizes, and media formats.
- **Narration**:
  > *"In CarbonProof AI, carbon claims are treated as unverified hypotheses until backed by immutable evidence documents. We now upload actual project documentation directly to the project's evidence vault. First, we attach the Project Design Document, a comprehensive PDF detailing baseline additionality barriers. Next, we upload field biomass sample inventory data in CSV format, recording tree diameter and allometric carbon calculations. Finally, we attach satellite remote sensing telemetry in JSON format, capturing canopy height models and vegetation indices. Each document is validated, securely persisted, and indexed."*

---

### Scene 4: Cryptographic Evidence Integrity & Tamper Proof (`01:48 - 02:22`)
- **Visual**: Evidence Table on Project Detail page.
- **On-Screen Action**: Visual cursor inspects the SHA-256 fingerprint column (`8d5bac3a...`). Clicks "Verify" button on the evidence record. Backend executes `POST /api/v1/evidence/:id/verify-integrity`, reading stored bytes from disk and re-hashing them. Green toast confirmation: *"SHA-256 integrity verified: Stored bytes match fingerprint."* Settlement status badge displays on-chain confirmation.
- **Narration**:
  > *"Every uploaded file is immediately fingerprinted using SHA-256. Notice our ethical verification boundary: matching cryptographic fingerprints guarantees that stored bytes are byte-for-byte identical to what was submitted, preventing retro-active alteration. We trigger the platform's integrity verification action: the backend reads the stored file, recalculates the cryptographic digest, and confirms an exact match against the ledger. It establishes immutable custody without claiming to replace on-ground physical inspection."*

---

### Scene 5: Deterministic Risk Assessment Execution (`02:22 - 02:52`)
- **Visual**: Assessments Tab on Project Detail workspace.
- **On-Screen Action**: Visual cursor clicks "Run Rule Assessment" in the project header. Real verification engine executes across project metadata and attached evidence. Toast notification: *"Assessment completed! Risk Score: 100/100 (LOW)"*. Tab automatically switches to Assessments. Accordion expands to reveal itemized rule evaluations.
- **Narration**:
  > *"With primary evidence in custody, we execute the platform's deterministic rules engine. Unlike opaque black-box neural networks, CarbonProof evaluates submitted projects against standardized carbon accounting criteria using transparent, reproducible rules. The engine evaluates additionality hurdles, baseline deforestation credibility, boundary validation, and provenance attachment, generating an overall risk score and an itemized breakdown."*

---

### Scene 6: Rule Findings & Actionable Remediation (`02:52 - 03:16`)
- **Visual**: Assessment Score Breakdown & Findings.
- **On-Screen Action**: Visual cursor scrolls down through the 14 evaluated carbon accounting rules: additionality barriers, baseline credibility, geographic boundary intersection, and unit consistency. Inspects findings, severity ratings, and remediation recommendations.
- **Narration**:
  > *"Reviewers can inspect each individual finding produced by the rules engine. Here, the system flags the absence of registered land tenure deed attachments, assigning a moderate severity and recommending submission of official cadastral records. The rules engine provides clear, actionable remediation guidance so project proponents know exactly what evidentiary gaps must be resolved."*

---

### Scene 7: Reviewer Queue & Separation of Duties (`03:16 - 03:45`)
- **Visual**: Authentication transition and Review Queue (`/reviews`).
- **On-Screen Action**: User logs out and re-authenticates as an accredited Reviewer (`reviewer@example.test`). Opens `/reviews`. Governance banner enforces separation of duties: authors cannot review or self-approve projects. Opens the Mount Kenya project audit, inputs written justification into the audit rationale textarea, and clicks "Submit Decision" (`APPROVED_FOR_INTERNAL_REVIEW`). Status updates to verified.
- **Narration**:
  > *"Integrity requires strict governance. We switch to the reviewer account to demonstrate separation of duties. Under our platform's governance model, project developers are prohibited from reviewing or approving their own submissions. An accredited reviewer audits the evidence vault and risk findings, records written justifications detailing the additionality verification, and submits an official approval decision, transitioning the project to verified internal status."*

---

### Scene 8: Credit Issuance, Retirement & EVM Settlement (`03:45 - 04:20`)
- **Visual**: Credit Registry (`/credits`).
- **On-Screen Action**: User navigates to `/credits`. Visual cursor clicks "Create Credit Batch", specifying `BATCH-MKENYA-2026-001` with `5000 tCO2e`. Issues the batch with mandatory UUID idempotency key. Clicks "Retire Credits" to retire `250 tCO2e` for the "Global Decarbonization Initiative" for Scope 3 voluntary offsetting. Solidity smart contract on Anvil EVM burns tokens, emitting an on-chain event receipt and updating balances to 4,750 active / 250 retired.
- **Narration**:
  > *"Once verified, the platform authorizes the creation and issuance of credit batches, protected by mandatory idempotency keys to eliminate duplicate minting across network retries. We mint five thousand metric tons of verified carbon credits. Next, we retire two hundred and fifty credits on behalf of a named corporate beneficiary for Scope 3 voluntary offsetting. The transaction settles directly against our Solidity smart contract on the EVM node, burning the credits and returning an immutable on-chain transaction receipt."*

---

### Scene 9: Zero-Trust Public Verification Portal (`04:20 - 04:46`)
- **Visual**: Public Verification Portal (`/public`).
- **On-Screen Action**: Visual cursor opens `/public` in an unauthenticated state. Enters `mount-kenya-agroforestry` in the public search bar and clicks "Verify Public Record". The public portal renders verified disclosure: project metadata, SHA-256 evidence digests, and retirement certificate serials without exposing confidential operational credentials.
- **Narration**:
  > *"Transparency extends to all market participants. In an unauthenticated session, any corporate buyer, auditor, or regulator can access the Zero-Trust Public Verification Portal. By querying the project identifier or evidence hash, the portal retrieves public project status, verified evidence fingerprints, and retirement certificate serials without exposing confidential operational data."*

---

### Scene 10: Immutable Audit Trail & Conclusion (`04:46 - 05:07`)
- **Visual**: Audit Trail (`/audit`).
- **On-Screen Action**: User switches back to Administrator and opens `/audit`. Displays the complete cryptographic lifecycle event timeline: project registration, evidence uploads, SHA-256 integrity verification, rules evaluation, reviewer approval, credit batch issuance, and retirement.
- **Narration**:
  > *"Finally, our immutable Audit Trail logs every state transition, evidence verification, reviewer approval, and settlement event with cryptographic timestamps and actor attribution. CarbonProof AI delivers deterministic rigor and cryptographic certainty, transforming voluntary carbon markets into a verifiable, trustworthy ecosystem."*
