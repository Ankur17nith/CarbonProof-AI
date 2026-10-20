# Security controls and limitations

Implemented prototype controls:

- bcrypt password hashing; no plaintext password persistence;
- JWT issuer, audience, expiry, and active-user checks;
- explicit role middleware and contributor project ownership checks;
- reviewer separation of duties for assessments;
- Helmet, CORS allow-listing, request body/upload limits, and rate limiting;
- Zod validation and safe error responses without stack traces;
- generated storage keys, traversal checks, exclusive file creation, basic
  content signatures, and server-computed SHA-256;
- sanitized download filenames and public/private evidence checks;
- correlation IDs and redacted structured logs;
- idempotency request hashing for local credit mutations;
- contract role checks, pause behavior, positive integer quantities, and unique
  operation IDs in the Solidity workspace.

Remaining high-impact work before production:

- Wire the runtime to Prisma/PostgreSQL and use database constraints in the
  actual request path.
- Replace the development bootstrap password and configure secret management.
- Add refresh-token rotation or a managed session strategy if long-lived access
  is required.
- Use object storage with backup, retention, malware scanning, and access policy.
- Add distributed rate limiting and production TLS/reverse-proxy controls.
- Integrate blockchain transaction persistence, receipt verification, and
  reconciliation without exposing a signer key.

Passing tests are not an independent smart-contract or application security
audit. No independent professional audit is claimed.
