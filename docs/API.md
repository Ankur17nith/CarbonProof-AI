# API contract

Base URL: `http://localhost:3000/api/v1` in local development. Every successful
JSON response uses `{ "data": ..., "requestId": "..." }`. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Safe human-readable message",
    "requestId": "correlation-id",
    "details": [{ "path": "field", "message": "..." }]
  }
}
```

## Authentication

Call `POST /auth/login` with a demo or provisioned account. Send the returned
token as `Authorization: Bearer <token>`. Roles are `CONTRIBUTOR`, `REVIEWER`,
and `ADMIN`. Public verification routes do not require a token.

## Endpoint inventory

| Method    | Path                                       | Access                  | Purpose                           |
| --------- | ------------------------------------------ | ----------------------- | --------------------------------- |
| GET       | `/health`                                  | public                  | API readiness summary             |
| POST      | `/auth/login`                              | public                  | Issue JWT                         |
| GET       | `/auth/me`                                 | authenticated           | Current user                      |
| POST      | `/projects`                                | contributor+            | Create project                    |
| GET       | `/projects`                                | authenticated           | Paginated/filterable project list |
| GET/PATCH | `/projects/:id`                            | owner/reviewer/admin    | Project detail/update             |
| GET       | `/projects/:id/evidence`                   | owner/reviewer/admin    | Evidence metadata                 |
| POST      | `/projects/:id/evidence`                   | owner/reviewer/admin    | Multipart or JSON evidence        |
| POST      | `/projects/:id/assessments`                | owner/reviewer/admin    | Run assessment                    |
| GET       | `/assessments/:id`, `/findings`, `/report` | authorized              | Assessment results                |
| GET/POST  | `/assessments/:id/reviews`                 | reviewer/admin for POST | Review history/decision           |
| POST      | `/credits/batches`                         | contributor/admin       | Create demo batch                 |
| POST      | `/credits/batches/:id/issue`               | admin                   | Issue integer quantity            |
| POST      | `/credits/batches/:id/retire`              | admin                   | Retire integer quantity           |
| GET       | `/public/projects/:id`                     | public                  | Disclosed project verification    |
| GET       | `/public/evidence/:id/verify`              | public if disclosed     | Hash integrity result             |
| GET       | `/public/credits/:recordId`                | public                  | Disclosed local credit state      |
| GET       | `/openapi.json`                            | public                  | Compact OpenAPI route summary     |

Issue and retire mutations require `Idempotency-Key`. Pagination uses `page` and
`pageSize` query parameters; list responses include `items`, `page`, `pageSize`,
`total`, and `totalPages` where pagination is implemented.
