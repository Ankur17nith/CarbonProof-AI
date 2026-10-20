# Frontend integration

Use `VITE_API_BASE_URL=http://localhost:3000/api/v1` for local development.
Fetch `/openapi.json` for the compact route inventory and use the response
envelope documented in `docs/API.md`.

## Suggested flow

1. Log in and retain the short-lived bearer token in an appropriate frontend
   token strategy; do not place backend secrets in frontend variables.
2. Create a project as a contributor.
3. Upload evidence with multipart `file` plus metadata, or submit JSON-derived
   evidence. Show the returned SHA-256 fingerprint.
4. Call the integrity endpoint before starting assessment when useful.
5. Create an assessment and render `findings`, `riskScore`, `riskLevel`, status,
   rule-set version, and recommendations.
6. Reviewers use `/reviews/queue`, then post a decision with a rationale.
7. Admins create demo batches and send integer quantities with a unique
   `Idempotency-Key` for issue/retire calls.
8. Public verification pages use the `/public/*` endpoints and must label
   synthetic records and local blockchain state honestly.

The current CORS default is `http://localhost:5173`. Configure
`CORS_ALLOWED_ORIGINS` for another frontend origin. The backend currently uses
in-memory records, so a browser refresh does not imply durable server state after
the process restarts.
