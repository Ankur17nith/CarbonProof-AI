# Carbon Credit Registry

This directory is an independent Foundry workspace for an evidence-backed carbon credit registry.

## Layout

- `src/CarbonCreditRegistry.sol` — the registry contract.
- `test/CarbonCreditRegistry.t.sol` — dependency-free Foundry tests.
- `foundry.toml` — compiler, source, test, and optimizer settings.

## Dependency assumptions

The contract does **not** import OpenZeppelin or any other package. It contains a small, local implementation of the parts of OpenZeppelin-style `AccessControl` and `Pausable` needed by this workspace. Solidity arithmetic checks are provided by Solidity `0.8.24`.

The test suite does not import `forge-std`; it declares only the Foundry `Vm` cheatcode interface it uses. A clean checkout therefore needs Foundry, but no package installation or library checkout.

## Contract behavior

The constructor takes one non-zero admin address and grants it:

- `DEFAULT_ADMIN_ROLE`
- `EVIDENCE_ROLE`
- `MINTER_ROLE`
- `RETIRER_ROLE`
- `PAUSER_ROLE`

The admin role administers all operational roles. Evidence IDs, project IDs, and operation IDs must be non-zero. Evidence IDs can be registered only once, and `registerEvidenceBatch` is atomic: a duplicate or invalid batch reverts the entire transaction. Issuance requires a registered evidence ID. Operation IDs are globally unique across both issuance and retirement. Retirement cannot exceed the currently available balance for a project. Pausing blocks evidence registration, issuance, and retirement while leaving reads and role administration available.

## Setup

Install Foundry using the official installer, then verify that `forge` is on `PATH`:

```sh
forge --version
```

No OpenZeppelin dependency is required. No `forge install` step is needed.

## Build and test

Run from this directory:

```sh
forge build
forge test
```

The single workspace test command is:

```sh
make test
```

The tests cover deployment and role setup, role grant/revocation and renunciation, evidence registration and duplicate rejection, batch registration, evidence-gated issuance, retirement and balance limits, duplicate operation IDs, invalid quantities, and pause behavior.

## Deployment

Set deployment values in your shell or copy `.env.example` to `.env` and load it with your preferred environment tool. Never commit a real private key.

```sh
forge create \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  src/CarbonCreditRegistry.sol:CarbonCreditRegistry \
  --constructor-args "$ADMIN_ADDRESS"
```

The deployer does not need to be the registry admin; the constructor assigns permissions to the supplied `ADMIN_ADDRESS`.
