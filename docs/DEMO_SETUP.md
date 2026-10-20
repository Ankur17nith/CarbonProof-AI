# CarbonProof AI — Demonstration Setup Guide

This guide describes how to start the complete environment to reproduce the hackathon walkthrough demonstration.

---

## 1. Prerequisites Checklist
- [x] Node.js 22.x installed
- [x] Foundry installed (`anvil`, `forge`)
- [x] Python 3 with `edge-tts` installed (for audio narration)
- [x] FFmpeg installed (for video processing and muxing)

---

## 2. Launching Required Daemons

### Service 1: Local Anvil EVM Node
```bash
anvil --port 8545 --host 127.0.0.1
```
*Port*: `8545` (Chain ID `31337`).

### Service 2: Backend Express API
```bash
# In CarbonProofAI/
npm run dev
```
*Port*: `3000` (Listening on `0.0.0.0:3000`).

### Service 3: Frontend React Client
```bash
# In CarbonProofAI/frontend/
npm run dev
```
*Port*: `5173` (Access via `http://localhost:5173`).

---

## 3. Demo Accounts & Quick-Login Credentials
- **Contributor**: `contributor@example.test` / `development-only-password-123`
- **Reviewer**: `reviewer@example.test` / `development-only-password-123`
- **Administrator**: `admin@example.test` / `development-only-password-123`

*(All three roles can be selected with a single click on the login screen `/login`)*
