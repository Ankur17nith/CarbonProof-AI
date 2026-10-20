# CarbonProof AI — Production Deployment Guide

This document outlines deployment architectures, operational security, database configuration, secret custody, and production safeguards.

---

## 1. Production Architecture Overview

In production, the platform is decoupled into independently scalable tiers:

```mermaid
graph LR
    User[Client Browsers] --> CDN[CloudFront / Cloudflare CDN]
    CDN --> S3Frontend[Static Frontend S3 / GCS Bucket]
    CDN --> ALB[Application Load Balancer / Ingress]
    ALB --> APITier[Express API Cluster (Node.js Pods)]
    APITier --> PG[(Amazon RDS / Aurora PostgreSQL)]
    APITier --> S3Evidence[(Encrypted Object Storage / S3 / GCS)]
    APITier --> KMS[Cloud KMS / Vault Signer]
    KMS --> L2[Ethereum / Arbitrum / Polygon L2 RPC]
```

---

## 2. Production Checklist & Environment Variables

### Mandatory Production Guardrails (Enforced in `src/config.ts`)
- `NODE_ENV=production`: Disables development auto-seeding.
- `USE_IN_MEMORY=false`: Forces durable PostgreSQL persistence.
- `JWT_SECRET`: Must be replaced with a cryptographically random string (min 32 characters). Starting with `development-only-` will throw an immediate fatal initialization error.
- `DATABASE_URL`: Must target a production-hardened PostgreSQL instance with SSL enabled (`?sslmode=require`).
- `CORS_ALLOWED_ORIGINS`: Restrict strictly to authorized frontend production domain(s).

---

## 3. Persistent Database Setup (PostgreSQL + Prisma)

1. Provision PostgreSQL 15+ with automated point-in-time backups.
2. Apply database migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Set connection string in environment:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<db-host>:5432/<dbname>?schema=public&sslmode=require"
   USE_IN_MEMORY=false
   ```

---

## 4. Evidence Storage & Object Retention

- In local development, files are written to `FILE_STORAGE_ROOT` (`./data/storage`).
- In production, implement an S3/GCS adapter utilizing content-addressed keys:
  - Enable bucket versioning and object lock (WORM compliance for audit proof).
  - Enable AES-256 server-side encryption (SSE-KMS).
  - Restrict public access via IAM roles; generate short-lived pre-signed URLs for authenticated downloads.

---

## 5. Blockchain Key Custody & Gas Management

- **Do Not Store Raw Private Keys in Environment Variables in Production**.
- Integrate with AWS KMS, Google Cloud KMS, or HashiCorp Vault transit secrets engine for transaction signing:
  - The API requests cryptographic signature of serialized EVM transactions through IAM-authenticated KMS endpoints.
  - Mitigates risk of server compromise leaking transaction signing keys.
- Target an EVM Layer 2 (e.g. Arbitrum, Base, Polygon) or private enterprise rollup for low gas costs, deterministic finality, and high throughput.

---

## 6. Containerization (Docker)

The repository provides a production multi-stage `Dockerfile`:
```bash
# Build production Docker image
docker build -t carbonproof-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e USE_IN_MEMORY=false \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="production-cryptographically-random-32char-secret" \
  carbonproof-api:latest
```

---

## 7. Monitoring & Health Checks

- Liveness endpoint: `GET /health/live` (HTTP 200 `status: ok`).
- Readiness endpoint: `GET /health/ready` (checks storage availability, database connectivity, and blockchain adapter state).
- Correlation tracking: All incoming requests are assigned or inherit `x-correlation-id` and emitted via structured JSON logs (`pino`).
