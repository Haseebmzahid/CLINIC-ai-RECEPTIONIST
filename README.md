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

The API listens on `http://localhost:4000` and exposes:

```bash
curl http://localhost:4000/api/health
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
- `GET /api/webhooks/whatsapp` Meta webhook verification handshake
- `POST /api/webhooks/whatsapp` WhatsApp inbound webhook with `X-Hub-Signature-256`
- `GET /api/availability?serviceId&from&to`
- `GET /api/appointments?from&to&status`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `DELETE /api/appointments/:id`
- `GET /api/services`
- `POST /api/services` owner only
- `PATCH /api/services/:id` owner only
- `GET /api/settings`
- `PUT /api/settings` owner only
- `GET /api/faqs`
- `POST /api/faqs`
- `PATCH /api/faqs/:id`
- `DELETE /api/faqs/:id`
- `GET /api/patients?q=search`
- `GET /api/patients/:id`
- `POST /api/patients`
- `PATCH /api/patients/:id`

## Current Scope

Prompt 6 is implemented: WhatsApp inbound webhook verification, fast async queue processing, tenant resolution by `phone_number_id`, idempotent patient/conversation/message persistence, availability generation, transactional double-booking-safe appointments, Firebase token verification, request context, tenant context, RBAC helpers, standard error envelope, `/api/me`, services/settings/FAQ/patient CRUD, custom-claims utility, tenant-scoped repositories, Firestore rules/indexes, deterministic seed data, and emulator-oriented repository tests.

## Local WhatsApp Webhook Testing

Run the API locally and expose it with ngrok:

```bash
pnpm --filter api dev
ngrok http 4000
```

Configure the Meta webhook callback URL to:

```text
https://<ngrok-host>/api/webhooks/whatsapp
```

Use `WHATSAPP_VERIFY_TOKEN` as the Meta verify token and set `WHATSAPP_APP_SECRET` locally so POST signatures can be verified. Seed or create a tenant whose `whatsapp.phoneNumberId` matches the inbound payload `metadata.phone_number_id`.
