# Deployment

The repository is buildable as a Node 22 container:

```sh
cp .env.example .env
npm ci
npm run prisma:generate
npm run build
npm start
```

Or:

```sh
docker build -t carbonproof-ai-backend .
docker run --rm --env-file .env -p 3000:3000 carbonproof-ai-backend
```

The Docker image starts `dist/src/server.js`, creates the local storage
directory, and does not automatically run migrations. A real deployment must
run migrations as an explicit release step, provide PostgreSQL, object storage,
TLS/reverse proxy, secret management, backups, monitoring, and a durable runtime
repository.

The default API mode is in-memory for local development. Use
`USE_IN_MEMORY=false` with reachable PostgreSQL for durable records. Production
still requires object storage, secret management, TLS/reverse proxy, a managed
signer, and background blockchain reconciliation.
