# Clinic AI Receptionist Agent Contract

This project implements "Clinic AI Receptionist", a multi-tenant SaaS WhatsApp receptionist for clinics. The single source of truth is `Clinic_AI_Receptionist_Spec.docx` ("Clinic AI Receptionist - Product Blueprint & Build Specification"). Build Section 37 in order and do not skip ahead.

## Tech Stack

- TypeScript everywhere, strict mode, no implicit `any`.
- Node.js 20+.
- Backend: Express on Railway.
- Frontend: Next.js App Router on Vercel.
- Database and auth: Firebase Firestore and Firebase Auth, using Firebase Admin SDK server-side.
- AI: OpenAI API with function/tool calling.
- Messaging: WhatsApp Business Cloud API (Meta Graph API).
- Validation: zod schemas at every external boundary.
- Testing: Vitest for unit/integration tests; Playwright for dashboard E2E when applicable.
- Styling: Tailwind CSS plus a small accessible component library such as shadcn/ui.

## Required Folder Layout

Follow the Section 23 layout exactly.

```text
repo-root/
apps/
api/                       # Node.js + Express backend (Railway)
src/
index.ts               # bootstrap, server
config/                # env loading, constants
middleware/            # auth, tenant, errorHandler, rateLimit, logger
routes/                # express routers (one per resource)
controllers/           # thin HTTP handlers
services/              # business logic
appointment.service.ts
availability.service.ts
conversation.service.ts
faq.service.ts
patient.service.ts
ai/
orchestrator.ts      # builds context, calls OpenAI
prompts.ts           # system + templates
tools.ts             # tool/function schemas + handlers
guardrails.ts
integrations/
whatsapp.ts          # sender + payload parsing
openai.ts
firebase.ts          # admin SDK init
repositories/          # firestore data access
jobs/                  # queue workers
utils/                 # logger, errors, time, ids
types/                 # shared TS types / zod schemas
test/                    # unit + integration tests
web/                       # Next.js dashboard (Vercel)
app/                     # App Router routes
components/
lib/                     # api client, auth, hooks
styles/
packages/
shared/                    # shared types/validators reused by api + web
.env.example
README.md
```

## Non-Negotiables

- Strict layering: `controller -> service -> repository`.
- Only repositories touch Firestore document paths and Firestore reads/writes.
- Tenant scoping is mandatory on every data access.
- Never trust a client-supplied `tenantId`; derive it from verified Firebase claims for dashboard/API requests, from `phone_number_id` mapping for WhatsApp webhooks, or from explicit platform-admin context only for platform-admin routes.
- zod validation is required at every boundary: HTTP body/query, webhook payloads, OpenAI tool args, and shared DTOs.
- No secrets in code, tests, client bundles, logs, or committed config. Read secrets from environment or a secret provider; document every variable in `.env.example`.
- Webhooks must ack fast, process asynchronously, and be idempotent by provider message/event id.
- Booking writes must happen inside Firestore transactions that re-check the interval and return `SLOT_TAKEN` on conflict.
- Deterministic logic for money, time, availability, booking, and confirmations belongs in code, not in the model.
- All external calls go through integration modules with timeouts, retries, and backoff.

## Coding Standards

- Use TypeScript strict mode across apps and packages.
- Use ESLint and Prettier; lint/type errors fail CI.
- Keep controllers thin: parse/validate, call services, shape responses.
- Keep services focused on business rules and orchestration.
- Keep repositories focused on tenant-scoped persistence.
- Use small, pure functions for business logic where practical.
- Use structured JSON logging with `requestId` and `tenantId` on every request/event.
- Redact secrets and avoid plaintext PII/message bodies in logs unless strictly required.

## Naming Conventions

- Files: kebab-case, for example `appointment.service.ts`.
- React components: PascalCase, one component per file.
- Types/interfaces: PascalCase.
- DTOs: suffix with `Dto`.
- zod schemas: suffix with `Schema`.
- Functions and variables: camelCase.
- Booleans: prefix with `is`, `has`, or `should`.
- Constants: `UPPER_SNAKE_CASE`.
- Firestore collections: plural lowercase.
- Firestore document fields: camelCase.
- Branches and commits: Conventional Commits.

## Error Handling Standards

- Throw typed `AppError` instances with `code` and `httpStatus`.
- Use one Express error middleware to map errors to the standard API envelope.
- Never leak stack traces to API clients or chat users.
- Log unexpected failures server-side with `requestId`.
- Booking conflicts return `SLOT_TAKEN` and should offer alternatives where relevant.
- External failures retry according to policy, then degrade gracefully; chat failures should escalate to human when needed.

## Security Practices

- Verify Firebase ID tokens with the Admin SDK on every protected request.
- Verify WhatsApp `X-Hub-Signature-256` on every relevant webhook POST.
- Apply Firestore Security Rules as defense-in-depth in addition to server checks.
- Sanitize and validate all input.
- Treat patient text as untrusted and prompt-injection aware.
- Use least-privilege service accounts and rotate keys.
- Rate-limit public and API routes per IP and per tenant.
- Use CORS allowlists for dashboard origins.
- Write audit logs for staff mutations.

## Definition of Done

Every task is done only when:

- The implementation is typed and passes strict typecheck.
- All external inputs are validated with zod.
- Unit tests and relevant integration/E2E tests are added or updated.
- Lint and tests pass.
- Tenant isolation is respected and covered by at least one test where applicable.
- `.env.example` is updated for new environment variables.
- `README.md` is updated when setup, run, emulator, seed, or deployment steps change.
- No secrets or unrelated scaffolding are introduced.

## Build Order Plan

1. Monorepo + tooling: create pnpm/Turborepo skeleton, `apps/api`, `apps/web`, `packages/shared`, TypeScript, lint, test tooling, `.env.example`, `README.md`, and placeholder app health/page tests.
2. Data layer: add shared Firestore types/zod schemas, Firebase Admin init, tenant-scoped repositories, indexes, security rules, deterministic seed, and emulator tests for round-trip and tenant isolation.
3. Auth & tenant context: add Firebase Auth verification, tenant/role request context, RBAC helpers, custom-claims utilities, and tests for token verification and denied cross-tenant access.
4. Core services: implement services/settings/profile, hours, FAQs, patients CRUD, routes/controllers, zod DTOs, and route/service tests.
5. Availability + booking: implement slot generation and transactional booking before chat, including timezone, buffers, lead time, holidays, status transitions, and conflict/concurrency tests.
6. WhatsApp inbound: implement webhook verification, fast ack, queue, tenant resolution from `phone_number_id`, idempotency, message/conversation persistence, and mocked webhook tests.
7. AI orchestrator: implement system prompt, tool schemas/handlers, context assembly, FSM validation, guardrails, mocked OpenAI tests, and no-fabricated-slot tests.
8. WhatsApp outbound: implement sender, confirmation messages, 24-hour-window/template handling, status callbacks, retry/backoff, and mocked Graph API tests.
9. End-to-end chat: wire greeting, FAQ, booking, and confirmation over the test-number flow with mocked AI/WhatsApp and conversation E2E tests.
10. Dashboard: implement Firebase login, protected layout, calendar, conversations/takeover, patients, settings, services, FAQs, typed API client, and Playwright coverage for key staff flows.
11. Logging/monitoring: add structured logs, health checks, Sentry/error tracking hooks, metrics/alerts documentation, and tests for request logging/error envelopes where practical.
12. Hardening + multi-tenant: add rate limits, audit logs, second-tenant seed/scenarios, stronger isolation tests, dependency/security checks, and production-readiness review.
13. Deploy: configure Vercel, Railway, Firebase production resources, CI smoke tests, environment documentation, and go-live checklist.
