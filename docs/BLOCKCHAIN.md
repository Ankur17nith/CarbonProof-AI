# Blockchain integration

`contracts/src/CarbonCreditRegistry.sol` is a small prototype registry, not a
tradable token. It stores evidence fingerprints and integer credit balances.
Roles control evidence registration, issuance, retirement, and pausing. The
contract rejects duplicate evidence IDs, duplicate operation IDs, zero
quantities, unauthorized calls, and retirement beyond available credits.

`src/blockchain/` provides an isolated viem adapter with:

- disabled mode with truthful safe-read results;
- chain ID, address, RPC, private-key, bytes32, and quantity validation;
- health checks for RPC, chain ID, contract bytecode, and signer availability;
- read methods for evidence, balances, roles, pause state, and operation IDs;
- transaction submission separate from receipt confirmation;
- reverted-receipt detection and confirmation-count handling.

The API constructs this adapter when `BLOCKCHAIN_ENABLED=true` and submits real
transactions only when a valid RPC, contract address, and signer are configured.
No transaction is fabricated when the adapter is disabled or unavailable. A
background reconciliation worker is still a production follow-up.

Foundry checks require `forge`:

```sh
cd contracts
make build
make test
```

No Sepolia address or transaction is committed. Never use a real private key in
the repository, and do not deploy this prototype to mainnet.
