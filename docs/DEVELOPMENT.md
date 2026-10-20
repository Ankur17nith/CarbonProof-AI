# CarbonProof AI — Local Development Guide

This guide details setting up the local development environment for both the backend and frontend services, running tests, and working with local blockchain tooling.

---

## 1. Quick Local Setup

### Step 1: Install Node.js Dependencies
```bash
# Root backend dependencies
npm install

# Frontend client dependencies
cd frontend && npm install && cd ..
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Key defaults in `.env`:
- `PORT=3000`: Backend listening port.
- `HOST=0.0.0.0`: Backend binding interface.
- `USE_IN_MEMORY=true`: Runs without needing a local PostgreSQL daemon.
- `BLOCKCHAIN_ENABLED=false`: Runs without requiring Anvil (or set to `true` when running Anvil).

### Step 3: Run the Services
Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
npm run dev
# Starts backend at http://0.0.0.0:3000 with auto-reload via tsx watch
```

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# Starts Vite dev server at http://localhost:5173
```

Open **`http://localhost:5173`** in your browser.

---

## 2. Pre-Seeded Development Accounts

In `development` mode, the backend automatically initializes three demo accounts:

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| **CONTRIBUTOR** | `contributor@example.test` | `development-only-password-123` | Create projects, upload evidence files, run assessments |
| **REVIEWER** | `reviewer@example.test` | `development-only-password-123` | Access Review Queue, make audit decisions (cannot review self) |
| **ADMIN** | `admin@example.test` | `development-only-password-123` | Full access, issue credit batches, retire credits, view audit trail |

The login page at `/login` provides 1-click role chips for instant evaluation.

---

## 3. Working with Local EVM (Foundry & Anvil)

To test on-chain registration and credit lifecycle operations:

### 1. Start Anvil
```bash
# In an independent terminal
anvil --port 8545 --host 127.0.0.1
```

### 2. Compile and Test Smart Contracts
```bash
cd contracts
forge build
forge test -vvv
cd ..
```

### 3. Deploy Contract to Anvil
```bash
export ETH_RPC_URL="http://127.0.0.1:8545"
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # Default Anvil Account 0

cd contracts
forge create src/CarbonCreditRegistry.sol:CarbonCreditRegistry \
  --rpc-url $ETH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 # Admin address
cd ..
```

### 4. Enable Blockchain in Backend
Set the following in `.env`:
```env
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
BLOCKCHAIN_CONTRACT_ADDRESS=<DEPLOYED_CONTRACT_ADDRESS>
BLOCKCHAIN_SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```
Restart the backend server (`npm run dev`).

---

## 4. Running Regression Tests

```bash
# Backend unit and integration tests (41 tests)
npm run test

# Local EVM integration test
npx vitest run tests/local-evm-integration.test.ts

# Frontend unit and component tests (23 tests)
cd frontend && npm run test && cd ..

# Full quality gate check (typecheck, lint, test, build)
npm run check
```
