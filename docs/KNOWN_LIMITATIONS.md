# Known limitations

- Runtime application records are process-local in the default mode; a Prisma
  store is wired for `USE_IN_MEMORY=false` but live database/concurrency testing
  remains outstanding.
- Local filesystem evidence storage has no object-store durability, backup,
  retention worker, malware scanner, or multi-instance coordination.
- Evidence deletion returns `501` because the prototype retention policy is not
  defined.
- The OpenAPI output is a compact route summary rather than a complete generated
  schema contract.
- `AI_PROVIDER=llm` is configuration-compatible only; no external LLM client is
  implemented or required for tests.
- The viem adapter is isolated and tested but not connected to API credit or
  evidence operations.
- No Sepolia deployment, actual explorer URL, or public transaction is claimed.
- The Solidity contract is a prototype registry and not a tradable ERC-20.
- Development-only demo users are bootstrapped into empty non-production stores.
- No refresh token, password reset, user registration, or account management API
  exists.
- No independent professional security audit has been performed.
- No performance/load benchmark has been run against external infrastructure.
