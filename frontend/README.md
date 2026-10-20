# CarbonProof AI — Frontend Application

Production-grade, zero-trust verification and explainable risk-scoring interface for environmental assets, carbon credits, and cryptographic dual-layer blockchain settlement. Built for the IEEE ClimateChain Global Hackathon 2026.

---

## Architecture Overview

The CarbonProof AI frontend is structured around an evidence-first, deterministic design language inspired by Claude's editorial simplicity, restrained typography, and functional whitespace, while maintaining an authentic carbon-accounting visual identity.

- **Framework**: React 18 with TypeScript 5.7 (Strict Mode)
- **Bundler & Tooling**: Vite 6, PostCSS, Tailwind CSS v3
- **State & Data Fetching**: TanStack Query v5 with automatic cache invalidation
- **Forms & Validation**: React Hook Form with Zod runtime schema validation
- **Routing**: React Router v6 with strict role-based route guards (`CONTRIBUTOR`, `REVIEWER`, `ADMIN`, `PUBLIC`)
- **Feedback & Notifications**: Sonner toasts with high-contrast accessibility tokens
- **Testing**: Vitest with `@testing-library/react` and `@testing-library/jest-dom`

---

## Directory Structure

```
frontend/
├── public/
│   └── logo.svg                 # Original carbon hexagon-leaf brandmark
├── src/
│   ├── components/
│   │   ├── layout/              # AppShell, Header, Sidebar, SkipLink
│   │   └── ui/                  # Accessible primitives (Button, Modal, Input, Badge, Table, etc.)
│   ├── features/
│   │   ├── auth/                # LoginPage, AuthGuard, session storage management
│   │   ├── dashboard/           # Metrics overview, synthetic disclosures, quick actions
│   │   ├── projects/            # Project Explorer, detail views, verification runner
│   │   ├── evidence/            # Evidence Vault, cryptographic hash upload & verification
│   │   ├── assessments/         # Explainable risk assessments, rule breakdowns, findings
│   │   ├── reviews/             # Review Queue, separation of duties, decision modals
│   │   ├── credits/             # Credit Registry, issuance/retirement, blockchain settlement
│   │   ├── audit/               # Immutable audit log viewer with entity filtering
│   │   └── public/              # Zero-trust public lookup portal for projects & evidence
│   ├── lib/
│   │   ├── api.ts               # Typed fetch client, JWT handling, multipart support
│   │   ├── auth.tsx             # AuthProvider, useAuth hook, role permission checking
│   │   ├── format.ts            # Formatting helpers, status mappings, truncateHash
│   │   └── utils.ts             # Tailwind class merge helper (cn)
│   ├── types/
│   │   └── api.ts               # Complete TypeScript types matching backend OpenAPI schemas
│   ├── test/                    # Unit, layout, format, and workflow test suites
│   ├── App.tsx                  # Root routes and providers
│   ├── index.css                # Claude-inspired design tokens, light/dark theme variables
│   └── main.tsx                 # Application entry point
├── docs/                        # Architecture, Design System, API & Audit documentation
├── index.html                   # HTML entry point with meta tags & Google Inter font
├── package.json                 # Scripts and dependency specifications
├── tailwind.config.js           # Warm neutral palette, forest green accents, status tokens
├── tsconfig.json                # TypeScript configuration
└── vite.config.ts               # Vite configuration with proxy to http://localhost:3000
```

---

## Quickstart

### Prerequisites
- Node.js >= 20
- Running backend on `http://localhost:3000` (or configured via Vite proxy)

### Development
```bash
# Install dependencies
npm install

# Start Vite dev server (with hot module replacement)
npm run dev
```
The application will be accessible at `http://localhost:5173`.

### Testing & Validation
```bash
# Typecheck TypeScript source
npm run typecheck

# Run Vitest test suite
npm run test

# Build production bundle
npm run build
```

---

## Roles & Separation of Duties

The platform strictly enforces role-based access control matching the backend API contracts:

| Role | Permissions & Visible Views |
|---|---|
| **CONTRIBUTOR** | Project submission, evidence upload, draft management |
| **REVIEWER** | Review queue, assessment verification, approving/rejecting claims (cannot self-approve) |
| **ADMIN** | Full governance, credit batch issuance/retirement, immutable audit trail access |
| **PUBLIC** | Unauthenticated zero-trust public verification portal (lookup by ID or evidence hash) |

---

## Synthetic Data Disclosure
All demo data seeded during development is explicitly tagged with `DataOrigin: SYNTHETIC_DEMO`. The frontend displays clear disclosures on all metrics, badges, and project views to ensure complete transparency in compliance with environmental verification ethics.
