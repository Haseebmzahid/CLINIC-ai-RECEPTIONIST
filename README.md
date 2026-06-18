# Clinic AI Receptionist

Multi-tenant WhatsApp receptionist for clinics, built from the product specification and prompt playbook in this workspace.

## Requirements

- Node.js 20+
- pnpm 11+

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env.local` for local values. Do not commit real secrets.

## Root Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Run The Apps

API:

```bash
pnpm --filter api dev
```

The API listens on `http://localhost:3001` and exposes:

```bash
curl http://localhost:3001/api/health
```

Web:

```bash
pnpm --filter web dev
```

The web app listens on `http://localhost:3000` and serves a placeholder page.

## Firestore Emulator And Seed

Start the Firestore emulator from the repo root:

```bash
firebase emulators:start --only firestore
```

In another terminal, point the API at the emulator and seed deterministic clinic data:

```bash
export FIREBASE_PROJECT_ID=clinic-ai-local
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
pnpm --filter api seed
```

On PowerShell:

```powershell
$env:FIREBASE_PROJECT_ID="clinic-ai-local"
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
pnpm --filter api seed
```

Run repository emulator tests with the same environment variables:

```bash
pnpm --filter api test
```

## Set Firebase Custom Claims

Use the API utility to set dashboard claims for onboarding/testing:

```bash
pnpm --filter api set-claims <uid> <tenantId> <owner|staff>
```

For a platform admin claim, omit the tenant:

```bash
pnpm --filter api set-claims <uid> platform_admin
```

## API Endpoints

Current protected dashboard endpoints require `Authorization: Bearer <Firebase ID token>`:

- `GET /api/me`
- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/health/metrics`
- `GET /api/health/sentry-test` non-production or `SENTRY_TEST_ENABLED=true`
- `GET /api/webhooks/whatsapp` Meta webhook verification handshake
- `POST /api/webhooks/whatsapp` WhatsApp inbound webhook with `X-Hub-Signature-256`
- `GET /api/availability?serviceId&from&to`
- `GET /api/appointments?from&to&status`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `DELETE /api/appointments/:id`
- `GET /api/conversations?state`
- `PATCH /api/conversations/:id`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`
- `GET /api/services`
- `POST /api/services` owner only
- `PATCH /api/services/:id` owner only
- `GET /api/settings`
- `PUT /api/settings` owner only
- `GET /api/faqs`
- `POST /api/faqs` owner only
- `PATCH /api/faqs/:id` owner only
- `DELETE /api/faqs/:id` owner only
- `GET /api/patients?q=search`
- `GET /api/patients/:id`
- `POST /api/patients`
- `PATCH /api/patients/:id`
- `POST /api/admin/tenants` platform admin only
- `PATCH /api/admin/tenants/:id` platform admin only
- `GET /api/admin/health` platform admin only

## Current Scope

Prompt 11 is implemented: Firebase email/password dashboard login, protected App Router dashboard shell, typed token-injecting API client with error-envelope parsing, TanStack Query provider, `/api/me` dashboard rendering, route skeletons for dashboard/appointments/conversations/patients/settings/admin tenants, platform-admin gating, inbound-to-AI-to-outbound conversation wiring, debounced AI turns, staff notification records for paused/escalated conversations, end-to-end chat tests for greeting/FAQ/booking/confirmation, conversation-level double-booking race coverage, WhatsApp outbound sending through Meta Graph API, retry/backoff for transient send failures, 24-hour-window template fallback, delivery status callback updates, failed-send staff surfacing, booking confirmation messages, AI booking confirmation wiring, AI prompt assembly, OpenAI tool schemas/handlers, conversation context and FSM updates, guardrails for medical advice/escalation/prompt secrecy, mocked OpenAI tests, WhatsApp inbound webhook verification, fast async queue processing, tenant resolution by `phone_number_id`, idempotent patient/conversation/message persistence, availability generation, transactional double-booking-safe appointments, Firebase token verification, request context, tenant context, RBAC helpers, standard error envelope, `/api/me`, services/settings/FAQ/patient CRUD, custom-claims utility, tenant-scoped repositories, Firestore rules/indexes, deterministic seed data, and emulator-oriented repository tests.

Prompt 11 adds dashboard appointment management: live dashboard appointment KPIs, needs-human alert counts, day/week calendar and appointment list filters, walk-in booking, reschedule, cancel, no-show actions, SLOT_TAKEN conflict messaging, and a Playwright happy-path test.

Prompt 12 adds the live conversations dashboard: polling inbox filters, state/needs-human/AI-paused badges, transcript rendering, staff manual replies through the outbound WhatsApp service, take-over/resume AI controls, and Playwright coverage for the staff takeover flow.

Prompt 13 completes the dashboard: patient search/detail/edit with booking history, owner-gated profile and working-hours settings, services/fees management, FAQ CRUD with tags, and Playwright coverage for editing a FAQ and seeing the saved value persist through dashboard navigation.

Prompt 14 adds observability: pino structured logs with `requestId`/`tenantId`, health/readiness/metrics endpoints, backend and frontend Sentry hooks with release and tenant tags, and counters for request latency, 5xxs, webhook queue/DLQ, WhatsApp send failures, AI errors, booking conflicts, and per-tenant usage.

Prompt 15 adds hardening: per-IP and per-tenant rate limits with `RATE_LIMITED` error envelopes, awaited audit log writes for staff mutations, platform-admin tenant onboarding endpoints and dashboard UI, seeded `clinic_b` data, tenant-isolation tests, short-TTL settings/phone mapping caches, paginated high-volume lists, and webhook idempotency TTL fields.

Prompt 16 adds CI/CD and deployment operations: PR validation through GitHub Actions, Firebase-emulator-backed test execution, main-branch deployment to Vercel, Railway, and Firebase Firestore config, post-deploy smoke tests, Railway runtime config, and this staging/production promotion runbook.

## Hardening And Multi-Tenant Operations

Tune API rate limits with `PUBLIC_RATE_LIMIT_WINDOW_MS`, `PUBLIC_RATE_LIMIT_MAX`, `TENANT_RATE_LIMIT_WINDOW_MS`, and `TENANT_RATE_LIMIT_MAX`. A limited request returns HTTP 429, `Retry-After`, and a standard `RATE_LIMITED` envelope.

Every staff mutation writes an immutable tenant-scoped `auditLogs` document containing `actorUid`, `role`, `action`, `target`, `meta`, and `at`. Platform-admin tenant onboarding is available at `/admin/tenants` in the dashboard and uses `/api/admin/tenants`.

The seed script provisions both `clinic_a` and `clinic_b`. Keep the Firestore emulator environment variables set when running isolation and repository tests so cross-tenant checks exercise the same data layout used locally.

## Observability And Alerts

Set `LOG_LEVEL=info` in production. Logs are JSON and redact secrets; patient message bodies and raw WhatsApp numbers should not be logged. Request logs include method, path, status, latency, `requestId`, and tenant context where available.

Configure Sentry with `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `APP_RELEASE`, and `SENTRY_TRACES_SAMPLE_RATE` for the API. Configure the dashboard with `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_APP_RELEASE`, and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`. Use `/api/health/sentry-test` outside production, or set `SENTRY_TEST_ENABLED=true`, to force a tagged test event.

Use an uptime monitor such as Better Stack or UptimeRobot against `/api/health` and `/api/health/ready`. Alert thresholds from the SRS:

- API down for more than 1 minute.
- AI reply p95 latency over 8 seconds for 5 minutes.
- 5xx rate over 2% for 5 minutes.
- Webhook queue backlog rising or DLQ greater than 0.
- WhatsApp send failure rate over 5%.
- OpenAI error/timeout rate over 5%.
- Booking conflicts spike suddenly.
- Per-tenant usage crosses plan limits.

`GET /api/health/metrics` exposes the current in-process counters for local smoke checks and external scraping.

Run the dashboard E2E test:

```bash
pnpm --filter web e2e
```

## Local WhatsApp Webhook Testing

Run the API locally and expose it with ngrok:

```bash
pnpm --filter api dev
ngrok http 3001
```

Configure the Meta webhook callback URL to:

```text
https://<ngrok-host>/api/webhooks/whatsapp
```

Use `WHATSAPP_VERIFY_TOKEN` as the Meta verify token and set `WHATSAPP_APP_SECRET` locally so POST signatures can be verified. Seed or create a tenant whose `whatsapp.phoneNumberId` matches the inbound payload `metadata.phone_number_id`.

## CI/CD And Deployment

GitHub Actions:

- `.github/workflows/ci.yml` runs on pull requests to `main`: install, typecheck, lint, then `firebase emulators:exec --only firestore,auth "pnpm --filter api seed && pnpm test"`.
- `.github/workflows/deploy.yml` runs on pushes to `main` for `staging` and can be manually dispatched for `staging` or `production`.
- Configure branch protection on `main` to require the `Typecheck, lint, emulator tests` status before merge.

GitHub environments:

- Create `staging` and `production` environments in GitHub.
- Add required reviewers for `production`.
- Store secrets only in GitHub/Vercel/Railway/Firebase, never in the repo.

Required GitHub environment secrets:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`
- `RAILWAY_TOKEN`
- `RAILWAY_API_SERVICE`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `SMOKE_API_BASE_URL`
- `SMOKE_AUTH_TOKEN`

`SMOKE_AUTH_TOKEN` must be a Firebase ID token for a non-production smoke-test user with valid `tenantId` and `role` custom claims. The smoke test calls `/api/health` and `/api/me`; override `SMOKE_AUTH_PATH` only if the minimal authenticated path changes.

### Vercel

Create separate Vercel projects or environments for staging and production. Set the project root to this repo and configure the web app build from `apps/web`; the workflow uses Vercel CLI with `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_TOKEN`.

Required Vercel environment variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_RELEASE`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`

### Railway

Create a Railway service for the API. The committed `railway.json` builds the API with `pnpm --filter api build` and starts it with `pnpm --filter api start`. The current worker is in-process with the API queue; if a dedicated worker process is split out later, add a second Railway service with the same env and a worker start command.

Required Railway environment variables:

- `NODE_ENV=production`
- `PORT`
- `APP_BASE_URL`
- `ALLOWED_ORIGIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_CONFIRMATION_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`
- `APP_RELEASE`
- `LOG_LEVEL`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `PUBLIC_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_RATE_LIMIT_MAX`
- `TENANT_RATE_LIMIT_WINDOW_MS`
- `TENANT_RATE_LIMIT_MAX`

### Firebase

Create separate Firebase projects for staging and production. Enable Firestore and Firebase Auth. The deployment workflow publishes `firestore.rules` and `firestore.indexes.json` using `FIREBASE_SERVICE_ACCOUNT_JSON`.

For local emulator checks:

```bash
pnpm dlx firebase-tools@latest emulators:exec --project clinic-ai-local --only firestore,auth "pnpm --filter api seed && pnpm test"
```

### WhatsApp Webhook Configuration

For staging, use the Meta test WhatsApp number and callback:

```text
https://<staging-api-host>/api/webhooks/whatsapp
```

For production, use the approved business number and callback:

```text
https://<production-api-host>/api/webhooks/whatsapp
```

In Meta App Dashboard, set the verify token to the exact `WHATSAPP_VERIFY_TOKEN` configured on Railway for that environment. Subscribe to message and status webhook fields. Set `WHATSAPP_APP_SECRET` on Railway so POST callbacks validate `X-Hub-Signature-256`. Each tenant's `whatsapp.phoneNumberId` in Firestore must match the incoming `metadata.phone_number_id`.

### OpenAI And WhatsApp Wiring

Set `OPENAI_API_KEY` and `OPENAI_MODEL` on Railway only. Set WhatsApp Graph API credentials on Railway only: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_CONFIRMATION_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE`. Do not expose these values to Vercel or any `NEXT_PUBLIC_*` variable.

### Production Promotion Runbook

1. Merge to `main` and confirm the staging deploy workflow passes.
2. Confirm `/api/health`, `/api/health/ready`, and the smoke authenticated path pass against staging.
3. In staging, verify the WhatsApp webhook with the Meta test number and send a booking test through confirmation.
4. Confirm Firestore rules/indexes are deployed to staging and tenant isolation smoke checks pass.
5. Confirm Sentry events include release, role, tenant, and request tags.
6. Dispatch the `Deploy` workflow manually with `environment=production`.
7. Confirm production smoke tests pass and uptime monitoring is green.
8. If smoke tests fail, roll back the Vercel deployment, redeploy the previous Railway service version, and redeploy the last known-good Firestore rules/indexes from git.
