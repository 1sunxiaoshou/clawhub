---
summary: "Public REST API (v1) overview and conventions."
read_when:
  - Building API clients
  - Adding endpoints or schemas
---

# API v1

Base: `https://clawhub.ai`

OpenAPI: `/api/v1/openapi.json`

## Auth

- Public read: no token required.
- Write + account: `Authorization: Bearer clh_...`.
- CLI tokens are accepted as HTTP Bearer tokens.

## Rate limits

Auth-aware enforcement:

- Anonymous requests: per IP.
- Authenticated requests (valid Bearer token): per user bucket.
- Missing/invalid token falls back to IP enforcement.

- Read: 180/min per IP, 900/min per key
- Write: 45/min per IP, 180/min per key

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After` (on 429).

Semantics:

- `X-RateLimit-Reset`: Unix epoch seconds (absolute reset time)
- `RateLimit-Reset`: delay seconds until reset
- `Retry-After`: delay seconds to wait on `429`

Example `429`:

```http
HTTP/2 429
x-ratelimit-limit: 20
x-ratelimit-remaining: 0
x-ratelimit-reset: 1771404540
ratelimit-limit: 20
ratelimit-remaining: 0
ratelimit-reset: 34
retry-after: 34
```

Client handling:

- Prefer `Retry-After` when present.
- Otherwise use `RateLimit-Reset` or derive delay from `X-RateLimit-Reset`.
- Add jitter to retries.

## Endpoints

Public read:

- `GET /api/v1/search?q=...`
  - Optional filters: `highlightedOnly=true`, `nonSuspiciousOnly=true`
  - Legacy alias: `nonSuspicious=true`
- `GET /api/v1/skills?limit=&cursor=&sort=`
  - `sort`: `updated` (default), `downloads`, `stars` (`rating`), `installsCurrent` (`installs`), `installsAllTime`, `trending`
  - `cursor` applies to non-`trending` sorts
  - Optional filter: `nonSuspiciousOnly=true`
  - Legacy alias: `nonSuspicious=true`
  - With `nonSuspiciousOnly=true`, cursor-based pages may contain fewer than `limit` items; use `nextCursor` to continue.
- `GET /api/v1/skills?scope=accessible`
  - Requires Bearer token.
  - Lists skills the token user can read through direct ownership, publisher membership, direct user grants, or publisher grants.
- `GET /api/v1/skills/{slug}`
  - May include `moderation` when a skill is flagged or the owner is viewing it.
  - `moderation.isSuspicious=true` is a warning signal, not a failed lookup.
  - `moderation.isMalwareBlocked=true` is a hard block; clients must not install it.
- `GET /api/v1/skills/{slug}/moderation`
  - Returns structured moderation details when available.
  - Public callers can read details for already-flagged visible skills.
- `GET /api/v1/skills/{slug}/versions?limit=&cursor=`
- `GET /api/v1/skills/{slug}/versions/{version}`
- `GET /api/v1/skills/{slug}/scan?version=&tag=`
- `GET /api/v1/skills/{slug}/file?path=&version=&tag=`
- `GET /api/v1/resolve?slug=&hash=`
- `GET /api/v1/download?slug=&version=&tag=`
  - Enforces malware blocks with an error response.
  - Suspicious-but-not-malware skills remain downloadable; installer clients should
    apply their own warning/confirmation policy.

Auth required:

- `POST /api/v1/skills` (publish, multipart preferred)
- `DELETE /api/v1/skills/{slug}`
- `POST /api/v1/skills/{slug}/undelete`
- `POST /api/v1/skills/{slug}/rename`
- `POST /api/v1/skills/{slug}/merge`
- `POST /api/v1/skills/{slug}/transfer`
- `POST /api/v1/skills/{slug}/transfer/accept`
- `POST /api/v1/skills/{slug}/transfer/reject`
- `POST /api/v1/skills/{slug}/transfer/cancel`
- `GET /api/v1/transfers/incoming`
- `GET /api/v1/transfers/outgoing`
- `GET /api/v1/me`
- `GET /api/v1/whoami`

## Legacy

Legacy `/api/*` and `/api/cli/*` still available. See `DEPRECATIONS.md`.
