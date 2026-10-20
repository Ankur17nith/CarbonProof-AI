# CarbonProof AI — Demonstration Setup Guide

This guide describes how to start the complete environment to reproduce the end-to-end, document-driven product demonstration.

---

## 1. Prerequisites Checklist
- [x] Node.js 22.x installed
- [x] Foundry installed (`anvil`, `forge`)
- [x] Python 3 with `edge-tts` installed (for neural audio narration)
- [x] FFmpeg installed with `libopenh264` and `subtitles` filter (for video assembly)
- [x] Google Chrome installed (for headless CDP screen capture)

---

## 2. Launching Required Daemons

### Service 1: Local Anvil EVM Node
```bash
anvil --port 8545 --host 127.0.0.1
```
*Port*: `8545` (Chain ID `31337`).

### Service 2: Smart Contract Deployment (Local EVM)
```bash
cd contracts
forge build
forge test -vvv
# Deployed contract address on Anvil: 0x5FbDB2315678afecb367f032d93F642f64180aa3
cd ..
```

### Service 3: Backend Express API (with Active Blockchain Settlement)
```bash
# In CarbonProofAI/
npm run dev
```
*Port*: `3000` (Listening on `0.0.0.0:3000`).
*Readiness Check*: `curl http://127.0.0.1:3000/health/ready`

### Service 4: Frontend React Client
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

---

## 4. Sample Demonstration Fixtures

Located under `fixtures/demo/`:
- `fixtures/demo/mount_kenya_pdd_v1.2.pdf`: Authentic Project Design Document with additionality barrier analysis (PDF format).
- `fixtures/demo/forest_biomass_inventory.csv`: Plot sample measurements with allometric biomass formulas (CSV format).
- `fixtures/demo/remote_sensing_canopy_metrics.json`: Satellite LiDAR canopy height telemetry and Sentinel-2 NDVI timeseries (JSON format).

---

## 5. Automated Demonstration Recording

To re-record the complete 10-scene walkthrough with synchronized audio and burned-in subtitles:

```bash
# 1. Generate master narration audio and subtitle cues
python3 scripts/generate-demo-audio.py

# 2. Execute headless Chrome choreography and compile master MP4
node scripts/record-real-demo.js
```

Master deliverables are output to:
- Video: `media/demo/carbonproof-demo.mp4` (1080p, 30 fps, burned-in subtitles)
- Captions: `media/demo/carbonproof-demo.srt`
- Production Log: `media/demo/DEMO_PRODUCTION_NOTES.md`
