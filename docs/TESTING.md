# Testing

The reproducible TypeScript checks are:

```sh
npm ci
npm run prisma:generate
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
npm run audit
```

`npm test` covers the framework-free verification engine, API auth and synthetic
workflow, and the isolated blockchain adapter. The API scenario checks project
creation, evidence hashing, integrity verification, assessment findings,
review separation, credit issue/retire, idempotent replay, excessive retirement
rejection, and public state.

Prisma migration and seed checks require a reachable PostgreSQL instance:

```sh
docker compose up -d postgres
npm run prisma:migrate
npm run prisma:seed
```

Those commands prepare the durable mode; run the API with `USE_IN_MEMORY=false`
to exercise the Prisma store. Live hydration/read-back was not possible in the
current environment because PostgreSQL was unavailable.

Foundry tests require the `forge` binary. Sepolia tests are intentionally not
run without an authorized RPC URL, funded signer, deployed address, and explicit
permission to spend testnet funds.
