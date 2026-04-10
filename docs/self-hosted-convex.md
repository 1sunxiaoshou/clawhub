---
summary: "Run ClawHub against a self-hosted Convex backend."
read_when:
  - Moving off Convex Cloud
  - Deploying your own Convex backend
  - Wiring local dev to a self-hosted Convex cluster
---

# Self-hosted Convex

This repo already gets its Convex endpoints from env vars:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `CONVEX_SITE_URL`

That means ClawHub does not need major code changes to run against a
self-hosted Convex backend. The main work is:

1. Run Convex on your own infrastructure.
2. Point the web app and Convex CLI at that backend.
3. Update auth callback URLs and `/api/*` routing.

## Recommended topology

Assume:

- one Linux host (or VM) for Convex
- PostgreSQL for Convex metadata/storage state
- HTTPS in front of Convex, e.g. `https://convex.example.com`
- the ClawHub web app on `https://clawhub.example.com`

You can also run both behind the same reverse proxy, but keeping the Convex
origin separate is the simplest starting point.

## 1) Bring up the self-hosted Convex backend

Follow the official Convex self-hosting guide to start the backend with Docker
and PostgreSQL:

- https://docs.convex.dev/self-hosting
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md

At a high level you need:

- a PostgreSQL database
- the Convex backend container(s)
- a persistent admin key
- an HTTPS base URL that your browser and OAuth provider can reach

Keep the following values handy after the backend is running:

- Convex base URL, e.g. `https://convex.example.com`
- Convex admin key

If you want a repeatable local bootstrap, this repo now includes helper
scripts for both Windows and Linux/macOS:

```powershell
bun run self-hosted:up
```

```bash
bun run self-hosted:up:linux
```

It will:

- run `docker compose up -d`
- generate and persist a local admin key in `.env.self-hosted.local` if missing
- remove stale `CONVEX_DEPLOYMENT` from `.env.local`
- move generated auth values such as `JWT_PRIVATE_KEY` / `JWKS` out of
  `.env.local` into `.env.self-hosted.local`
- generate local Convex Auth signing keys if missing
- deploy Convex functions to the self-hosted backend
- sync backend runtime env vars from `.env.local` and
  `.env.self-hosted.local`, except built-in `CONVEX_SITE_URL`

The generated file is gitignored by the repo's `.env*.local` ignore rule, so
it is safe to keep machine-local bootstrap state there.

## 2) Point the Convex CLI at your self-hosted backend

In every shell where you run `bunx convex ...`, export:

```bash
export CONVEX_SELF_HOSTED_URL=https://convex.example.com
export CONVEX_SELF_HOSTED_ADMIN_KEY=<your-admin-key>
```

The project already uses the normal Convex CLI commands, so after those env
vars are set you can keep using the same workflows:

```bash
bunx convex deploy --typecheck=disable --yes
```

For self-hosted Docker setups, prefer `deploy` rather than `dev`.

Important:

- Do not mix `bunx convex dev` with a self-hosted workflow in the same repo.
- `convex dev` creates a separate local deployment and writes
  `CONVEX_DEPLOYMENT=...` into `.env.local`.
- If `CONVEX_DEPLOYMENT` is set at the same time as
  `CONVEX_SELF_HOSTED_URL` / `CONVEX_SELF_HOSTED_ADMIN_KEY`, Convex CLI
  commands such as `deploy` and `env set` will fail.

If you previously ran `bunx convex dev`, remove the `CONVEX_DEPLOYMENT` line
from `.env.local` before continuing.

## 3) Configure the ClawHub web app

Set the frontend/runtime env vars so the app talks to your self-hosted Convex
origin instead of a Convex Cloud deployment:

```bash
VITE_CONVEX_URL=https://convex.example.com
VITE_CONVEX_SITE_URL=https://convex.example.com
CONVEX_SITE_URL=https://convex.example.com
SITE_URL=https://clawhub.example.com
```

Keep using the other existing app env vars as before:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `OPENAI_API_KEY`

But note the separation:

- `.env.local` configures the frontend / local app process.
- `.env.self-hosted.local` is managed by the bootstrap script for generated
  secrets such as the admin key, `JWT_PRIVATE_KEY`, and `JWKS`.
- The self-hosted Convex backend container does not automatically read this
  repo's `.env.local`.
- Runtime secrets needed by Convex functions must be set on the self-hosted
  Convex deployment itself with `bunx convex env set ...`.

For local web development against your self-hosted backend:

```bash
VITE_CONVEX_URL=https://convex.example.com
VITE_CONVEX_SITE_URL=https://convex.example.com
CONVEX_SITE_URL=https://convex.example.com
SITE_URL=http://localhost:3000
bun run dev
```

## 4) Configure GitHub OAuth

This app uses Convex Auth with GitHub OAuth. The callback must target your
self-hosted Convex origin:

```text
https://convex.example.com/api/auth/callback/github
```

Set your GitHub OAuth App values in the Convex/backend environment:

```bash
bunx convex env set AUTH_GITHUB_ID <your-client-id>
bunx convex env set AUTH_GITHUB_SECRET <your-client-secret>
bunx convex env set SITE_URL https://clawhub.example.com
bunx convex env set JWT_PRIVATE_KEY '<your-private-key>'
bunx convex env set JWKS '<your-jwks-json>'
```

`convex/auth.config.ts` still reads `process.env.CONVEX_SITE_URL`, but on
self-hosted Convex that value is built in and comes from the backend's site
origin configuration instead of `bunx convex env set`. In the Docker compose
setup in this repo, that means keeping `CONVEX_SITE_ORIGIN` / port `3211`
pointed at the correct public Convex site URL.

If GitHub auth env vars appear to be "missing", check the deployment env, not
just `.env.local`:

```bash
bunx convex env list
```

Or resync them from `.env.local` with the helper script:

```powershell
bun run self-hosted:up -- -SkipDocker -SkipDeploy
```

That helper intentionally skips `CONVEX_SITE_URL` because self-hosted Convex
rejects overriding it as an env var.

## 5) Generate or install JWT signing keys

This repo expects:

- `JWT_PRIVATE_KEY`
- `JWKS`

The bootstrap script can generate these automatically and save them in
`.env.self-hosted.local` before syncing them to the backend environment.
If you want to rotate them, run:

```powershell
bun run self-hosted:up -- -RegenerateAuthKeys -SkipDocker -SkipDeploy
```

## 6) Fix `/api/*` routing

Important: this repo's current `vercel.json` rewrites `/api/*` to a specific
Convex-hosted origin. If you move to self-hosted Convex, that rewrite must be
updated or replaced.

Options:

- If you keep Vercel for the web app, change the rewrite destination to your
  self-hosted Convex origin.
- If you self-host the web app too, configure Nginx/Caddy/Traefik to proxy
  `/api/*` to `https://convex.example.com/api/*`.
- For SSR and local dev, the app already falls back to `VITE_CONVEX_SITE_URL`,
  so the main blocker is production browser traffic.

## 7) Start order

Recommended bring-up order:

1. Start PostgreSQL.
2. Start self-hosted Convex.
3. Fill in `.env.local` with your non-generated app settings.
4. Run `bun run self-hosted:up`.
5. Start or deploy the web app with the `VITE_CONVEX_*` / `CONVEX_SITE_URL`
   values pointed at your Convex origin.

If you need to wipe local generated bootstrap state and recreate it from
scratch, run:

```powershell
bun run self-hosted:up -- -ResetGeneratedState
```

## 8) Smoke checks

Verify the backend directly:

```bash
curl -i https://convex.example.com/api/version
curl -i "https://convex.example.com/api/v1/search?q=test"
```

If you want to verify that functions were actually pushed to the self-hosted
deployment, also run:

```bash
bunx convex run users:me '{}'
```

Verify the site path through your public web app:

```bash
curl -i "https://clawhub.example.com/api/v1/search?q=test"
curl -i "https://clawhub.example.com/api/v1/skills/gifgrep"
```

Then test auth and CLI:

```bash
clawhub login --site https://clawhub.example.com
clawhub whoami --site https://clawhub.example.com
```

## Notes for this repo

- Frontend Convex client: `src/convex/client.ts`
- Auth provider domain: `convex/auth.config.ts`
- Server/client package API routing: `src/lib/packageApi.ts`
- Current Vercel rewrite: `vercel.json`

Those are the first places to inspect if traffic still points at an old Convex
Cloud hostname after migration.
