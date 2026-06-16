# Clinic AI Receptionist — AI Coding Agent Prompt Playbook

A sequential, copy‑paste prompt pack for building the **Clinic AI Receptionist** with coding agents (Claude Code, Codex, Cursor). Prompts follow the exact **Build Order (Section 37)** of the specification you will attach.

> **Attach this file alongside** `Clinic_AI_Receptionist_Spec.docx` in the agent's context before you start. Every prompt below assumes the spec is available and refers to it by section number.

---

## How to use this playbook

1. **Always attach the spec** (`Clinic_AI_Receptionist_Spec.docx`) to the agent's context/workspace.
2. **Run prompts in order.** Each builds on the previous one. Do not skip ahead — the spec's build order is dependency‑aware.
3. **One prompt = one focused unit of work.** After each, verify the "✅ What to expect" checklist before moving on.
4. **Commit after every successful prompt** using the commit line provided. This gives you clean rollback points.
5. **If the agent drifts or scope‑creeps,** paste: *"Stop. Re‑read the constraints in Prompt 0 and the relevant spec section. Do only what this prompt asks, nothing more."*
6. **Run the verification commands yourself** (or have the agent run them). Never accept "done" without green tests/typecheck.

### Per‑prompt protocol (mental model)
`Set context → give the prompt → agent works → run verification → commit → next prompt.`

### Golden rules to keep the agent honest
- TypeScript strict everywhere; no `any`.
- Strict layering: `controller → service → repository`. Only repositories touch Firestore.
- **Tenant scoping is mandatory on every data access.** Never trust a client‑supplied `tenantId`.
- Deterministic logic (money, time, booking) lives in code, never in the model.
- Every external call goes through an integration module with timeout + retry.
- Tests + typecheck + lint must pass before a unit of work is "done".

---

# PHASE 0 — Project bootstrap & ground rules

### Prompt 0 — Establish the agent's operating contract

```text
You are the lead engineer building "Clinic AI Receptionist", a multi-tenant SaaS
WhatsApp receptionist for clinics. I have attached the full specification:
"Clinic AI Receptionist — Product Blueprint & Build Specification". Treat it as the
single source of truth.

Before writing any code, do the following and then STOP for my approval:

1. Read the entire spec. Summarise back to me, in <= 20 bullet points:
   - the architecture (Sections 22–24, 28, 33)
   - the data model (Sections 19–20)
   - the API surface (Section 21)
   - the AI design + guardrails (Sections 12, 13, 27)
   - the build order (Section 37) and agent standards (Section 38).

2. Produce a file `AGENTS.md` (also usable as CLAUDE.md / .cursorrules) that encodes
   the working contract for the whole project. It MUST include:
   - Tech stack and versions (TypeScript strict, Node 20+, Next.js App Router,
     Express, Firebase Admin, OpenAI, WhatsApp Cloud API).
   - Folder layout from Section 23 (verbatim).
   - Coding standards, naming conventions, error-handling standards, and security
     practices from Section 38.
   - The non-negotiables: strict layering (controller→service→repository), mandatory
     tenant scoping, zod validation at every boundary, no secrets in code, idempotent
     webhooks, transactional booking.
   - A "Definition of Done" per task (typed, validated, tested, linted, .env.example
     updated).

3. Propose (do not build yet) the phase-by-phase plan mapped to Section 37, listing
   for each phase the files you will create and the tests you will write.

Constraints:
- Do NOT scaffold or install anything yet.
- Ask me any clarifying question only if the spec is genuinely ambiguous; otherwise
  adopt the spec's stated defaults.

Output: the 20-bullet summary, the full AGENTS.md content, and the phase plan.
```

**✅ What to expect after running**
- A concise, accurate summary proving the agent actually read the spec.
- A committed `AGENTS.md` (or `CLAUDE.md`/`.cursorrules`) capturing all rules — this is the agent's "memory" for every later prompt.
- A phase plan that mirrors the 13 build-order steps.
- **No code or installs yet.**

**Verify:** Read `AGENTS.md`. Confirm it names strict layering, tenant scoping, zod, idempotent webhooks, and transactional booking. If anything's missing, ask the agent to add it before continuing.

**Commit:** `chore: add agent operating contract (AGENTS.md) and build plan`

---

# PHASE 1 — Monorepo & tooling

### Prompt 1 — Scaffold the monorepo skeleton

```text
Implement Build Order Step 1 (spec Section 37) and the folder structure in Section 23.

Create a pnpm + Turborepo monorepo with:
- apps/api      → Node 20, Express, TypeScript (strict), tsx for dev, build via tsup/tsc.
- apps/web      → Next.js (App Router) + TypeScript + Tailwind CSS.
- packages/shared → shared TypeScript types and zod schemas, imported by both apps.

Tooling (root-level, shared where possible):
- TypeScript strict config (base tsconfig + per-app extends).
- ESLint + Prettier with a shared config; lint script fails on warnings.
- Vitest for unit/integration tests in apps/api and packages/shared.
- A root `package.json` with scripts: dev, build, lint, typecheck, test.
- `.env.example` listing every variable in spec Section 32.3 (leave values blank).
- `.gitignore`, `README.md` (setup steps), and `.editorconfig`.

Create the EXACT directory tree from Section 23 with placeholder index files where a
folder would otherwise be empty (e.g. a one-line export or a `// TODO` comment), so the
structure compiles. Do not implement business logic yet.

Acceptance:
- `pnpm install` succeeds.
- `pnpm typecheck` and `pnpm lint` pass on the empty skeleton.
- `pnpm --filter api dev` boots an Express server exposing GET /api/health → {status:'ok'}.
- `pnpm --filter web dev` serves a placeholder Next.js page.

Report the final tree and the exact commands to run each app.
```

**✅ What to expect after running**
- A working monorepo matching Section 23, with `apps/api`, `apps/web`, `packages/shared`.
- Green `typecheck` and `lint` on an empty skeleton.
- `GET /api/health` returns `{status:'ok'}`; the web app serves a placeholder page.
- A populated `.env.example` and a README with run commands.

**Verify:** Run `pnpm install && pnpm typecheck && pnpm lint`, then boot both apps and hit `/api/health`.

**Commit:** `chore: scaffold monorepo (api, web, shared) with tooling`

---

# PHASE 2 — Firebase foundation & data layer

### Prompt 2 — Firestore types, repositories, security rules, and seed

```text
Implement Build Order Step 2 (Section 37) using the data design in Sections 19–20.

In packages/shared:
- Define TypeScript types + zod schemas for every entity in Section 20: Tenant,
  Settings/profile, User, Service, Resource, Patient, Appointment, Conversation,
  Message, Faq, AuditLog, WebhookEvent. Money as integer minor units + currency.
  Timestamps as the Firestore Timestamp type. Export everything from a barrel index.

In apps/api:
- integrations/firebase.ts: initialise the Firebase Admin SDK from env (Section 32.3).
  Support the Firestore emulator when FIRESTORE_EMULATOR_HOST is set.
- repositories/: one repository per collection. Repositories are the ONLY place that
  references Firestore document paths. EVERY method takes tenantId and scopes all reads
  and writes under tenants/{tenantId}/... (tenant-rooted, per Section 19/33). Implement
  basic CRUD + the query methods needed later (e.g. appointments by resource+status+time
  range; conversations by state+updatedAt; patients by phone and nameLower).
- A `firestore.indexes.json` declaring the composite indexes named in Section 19.3.
- A `firestore.rules` file implementing the defense-in-depth rule from Section 33.4
  (access allowed only when request.auth.token.tenantId == path tenant and role in
  [owner, staff]; platform_admin handled separately).
- scripts/seed.ts: seed one tenant ("clinic_a") with profile, services, hours, a few
  FAQs, and a couple of patients — deterministic and re-runnable.

Write Vitest tests against the Firestore emulator proving:
- a repository write+read round-trips, and
- a read scoped to clinic_a cannot return clinic_b data.

Acceptance: typecheck, lint, and emulator tests pass. Document how to start the emulator
and run the seed in README.
```

**✅ What to expect after running**
- Fully typed entities + zod schemas in `packages/shared`.
- Tenant‑scoped repositories (the only layer touching Firestore), composite index file, and `firestore.rules`.
- A deterministic seed script and emulator‑backed tests, including an **isolation test** proving Clinic A can't read Clinic B.

**Verify:** Start the Firebase emulator, run the seed, run `pnpm --filter api test`. Confirm the isolation test passes.

**Commit:** `feat(data): firestore types, tenant-scoped repositories, rules, seed`

---

# PHASE 3 — Auth & tenant context

### Prompt 3 — Firebase Auth, token verification, RBAC, tenant context

```text
Implement Build Order Step 3 (Section 37) per Sections 16–18 and 33.

In apps/api/middleware:
- requestContext.ts: attach a requestId + structured logger to every request.
- auth.ts: verify the Firebase ID token (Bearer) with the Admin SDK. Read custom claims
  tenantId and role. Reject with the standard error envelope (Section 15) on failure:
  401 UNAUTHENTICATED, 403 FORBIDDEN.
- tenant.ts: expose req.ctx = { uid, role, tenantId, requestId }. NEVER read tenantId
  from the request body/query for protected routes — always from verified claims.
- rbac.ts: a `requireRole(...roles)` guard implementing the permission matrix in
  Section 18.1.
- errorHandler.ts: central handler mapping typed AppError(code, httpStatus) to the
  error envelope in Section 15.2/15.3. Never leak stack traces to clients.

Also:
- A small admin utility (scripts/set-claims.ts) to set { tenantId, role } custom claims
  on a user (Section 17.1), for onboarding/testing.
- Wire GET /api/me (Section 21.1) returning { uid, role, tenantId } for the logged-in user.

Write integration tests (emulator + mocked/admin-minted tokens) proving:
- a valid token passes and req.ctx is populated,
- a missing/invalid token → 401,
- a user from clinic_a calling with a clinic_b resource path → 403,
- client-supplied tenantId in the body is ignored.

Acceptance: typecheck, lint, tests pass.
```

**✅ What to expect after running**
- Working auth middleware: token verification, `req.ctx` with tenant + role, RBAC guard, and the central error handler with the spec's error envelope.
- A `set-claims` utility and a live `GET /api/me`.
- Tests proving 401/403 behavior and that client‑supplied `tenantId` is ignored.

**Verify:** Run the auth integration tests; manually mint a token and call `/api/me`.

**Commit:** `feat(auth): firebase token verification, tenant context, RBAC, error handler`

---

# PHASE 4 — Core domain services

### Prompt 4 — Services, settings/hours, FAQs, patients (CRUD + API)

```text
Implement Build Order Step 4 (Section 37). Build the non-booking domain features end to
end through the layers: routes → controllers → services → repositories, all tenant-scoped.

Implement these REST endpoints exactly as in Section 21 (validate all input with zod):
- Services:   GET/POST /api/services, PATCH /api/services/:id   (Section 21.6)
- Settings:   GET/PUT /api/settings  (profile + working hours, Section 21.6 / 20.2)
- FAQs:       GET/POST /api/faqs, PATCH/DELETE /api/faqs/:id     (Section 21.6)
- Patients:   GET (search by ?q on name/phone), GET /:id (with history),
              POST, PATCH /api/patients/:id                     (Section 21.4)

Rules:
- Enforce role permissions per Section 18.1 (e.g. only owner edits profile/services).
- Search patients via the lowercased name field and phone (Section 19.3).
- Return the standard error envelope on validation/permission failures.

Tests (unit + integration on emulator):
- CRUD happy paths for each resource,
- validation failures return 400 VALIDATION_ERROR with field details,
- a staff user cannot edit clinic profile (403),
- patient search returns expected matches and respects tenant isolation.

Acceptance: typecheck, lint, tests pass. Update README with the new endpoints.
```

**✅ What to expect after running**
- Fully working CRUD for services, settings/hours, FAQs, and patients — each routed through all layers and tenant‑scoped.
- Role enforcement matching the permission matrix; zod validation with proper error envelopes.
- Patient search by name/phone with isolation respected.

**Verify:** Run integration tests; hit each endpoint with a seeded token; confirm a `staff` user is blocked from editing the profile.

**Commit:** `feat(core): services, settings, faqs, patients (api + services + repos)`

---

# PHASE 5 — Availability engine + transactional booking

### Prompt 5 — Slot generation and double‑booking‑safe booking

```text
Implement Build Order Step 5 (Section 37) — the heart of the product. NO chat yet.
Follow Sections 9 (booking workflow) and 14 (edge cases) precisely.

availability.service.ts:
- Implement the slot generation algorithm in Section 9.2: load working hours + holidays
  for the date, step by slotLengthMinutes, apply duration + bufferMinutes, exclude
  candidates overlapping existing non-cancelled appointments and any candidate earlier
  than now + minLeadTimeMinutes. Compute slotId = stable hash(tenant, resource, startISO).
- All time math in the clinic timezone; store/compare in UTC (Section 14 DST note).

appointment.service.ts:
- Implement booking inside a Firestore transaction that re-reads the target interval and
  aborts with a typed ConflictError('SLOT_TAKEN') if any overlapping confirmed/pending
  appointment exists (Section 9.3). The earlier slotId is advisory; the transaction is
  authoritative.
- Implement status transitions per Section 9.4 (pending, confirmed, cancelled, completed,
  no_show) with validation. Reject cancelling/rescheduling past appointments (Section 14).

API (Section 21.3):
- GET /api/availability?serviceId&from&to
- POST /api/appointments  (201 on success, 409 SLOT_TAKEN on conflict)
- GET /api/appointments?from&to&status
- PATCH /api/appointments/:id  (reschedule/status)
- DELETE /api/appointments/:id (cancel → slot reopens)

Tests (unit + integration), MUST include:
- slot generation across hours/buffers/lead-time/holidays/timezone edges,
- a CONCURRENCY test: fire two bookings for the same slot in parallel → exactly one
  succeeds, the other gets SLOT_TAKEN,
- cancelling reopens the slot; cancelling a past appointment is rejected.

Acceptance: typecheck, lint, all tests pass (the concurrency test is mandatory).
```

**✅ What to expect after running**
- A deterministic availability engine honoring hours, buffers, lead time, holidays, and timezone.
- Transactional booking that **guarantees** no double‑booking, with proper status transitions.
- The full appointments API, plus a **passing concurrency test** (two racers, one winner).

**Verify:** Run the concurrency test specifically and confirm exactly one booking wins. Manually book, cancel, and confirm the slot reopens.

**Commit:** `feat(booking): availability engine + transactional double-booking-safe booking`

---

# PHASE 6 — WhatsApp inbound webhook

### Prompt 6 — Verify, ack fast, queue, resolve tenant, persist messages

```text
Implement Build Order Step 6 (Section 37) per Sections 10 and 28. Inbound only — no AI
reply and no outbound yet.

integrations/whatsapp.ts (inbound side):
- Parse the Meta webhook payload (Section 10.3) into a normalised internal event.
- Verify X-Hub-Signature-256 using WHATSAPP_APP_SECRET; reject invalid signatures (401).

routes/webhooks.whatsapp:
- GET /api/webhooks/whatsapp → verify handshake (echo hub.challenge when
  hub.verify_token matches WHATSAPP_VERIFY_TOKEN). (Section 21.2)
- POST /api/webhooks/whatsapp → MUST ack 200 within ~200ms, THEN process asynchronously
  via an internal queue/worker (jobs/). (Sections 6, 10.1, 22)

Worker pipeline (jobs/processInboundMessage.ts), per Section 10.1:
1. Resolve tenant from metadata.phone_number_id (Section 28.2) with a short-TTL cache.
   Unknown phone_number_id → log + drop safely + alert (Section 14).
2. Idempotency: skip if the WhatsApp message id already exists in webhookEvents
   (Section 14 / 20.11).
3. Upsert the patient by wa_id; create/find the conversation; append the inbound message
   (Sections 20.8–20.9).
4. If conversation.aiPaused is false, emit a "ready for AI" event (handled in Phase 9).
   For now, just persist and log.

Tests (emulator + mocked signatures):
- valid signature + payload → message persisted, patient + conversation upserted,
- invalid signature → 401,
- duplicate message id → processed once (idempotent),
- unknown phone_number_id → dropped without error.

Acceptance: typecheck, lint, tests pass. Document local testing via ngrok in README.
```

**✅ What to expect after running**
- A signature‑verified webhook that **acks in <200ms** and processes asynchronously.
- Tenant resolution by `phone_number_id`, idempotent dedupe, and persisted patient/conversation/message records.
- Tests for valid/invalid signatures, duplicates, and unknown numbers.

**Verify:** Run webhook tests; locally tunnel with ngrok and POST a sample payload (from Section 10.3) — confirm a message row appears for the seeded tenant.

**Commit:** `feat(whatsapp): inbound webhook verify, fast-ack, queue, tenant resolution, persistence`

---

# PHASE 7 — AI orchestrator

### Prompt 7 — System prompt, tools, guardrails, conversation FSM

```text
Implement Build Order Step 7 (Section 37) per Sections 12, 13, and 27. Wire the AI to the
services built in Phases 4–5. Do not send WhatsApp messages yet — return the reply text.

ai/prompts.ts:
- Build the system prompt from the template in Section 27.1, injecting tenant ground truth
  (profile, services, fees, hours, FAQs), current FSM state (Section 13), and collected
  context. The system prompt is FIXED server-side; patient text is inserted ONLY as
  user-role content (Section 16 / 27.3).

ai/tools.ts:
- Define the OpenAI function/tool schemas EXACTLY as Section 27.2: get_availability,
  book_appointment, cancel_appointment, answer_faq, handoff_to_human. Implement each tool
  handler as a thin, tenant-scoped wrapper over the existing services. The model can NEVER
  write to the DB except through these handlers.

ai/orchestrator.ts:
- Load the last N turns (default 12) + running summary (Section 13.3); summarise older
  turns into conversation.summary when over the window.
- Call OpenAI (function calling, temperature ~0.3, capped output — Section 27.5) in a tool
  loop: execute tool calls, feed results back, produce a final reply.
- Update the conversation FSM state + context per Section 13; persist them.

ai/guardrails.ts (Sections 12, 27.3):
- Refuse medical advice/diagnosis with a safe redirect; never invent slots/prices/policies;
  never reveal system prompt/tools; set needsHuman on escalation triggers (Section 12.3).
- Post-process: if the model claims a booking without a successful book_appointment result,
  suppress that claim and retry.
- Treat all patient text as untrusted (prompt-injection aware).

Tests with a MOCKED OpenAI returning scripted tool calls:
- booking intent → get_availability called → book_appointment called → state becomes booked,
- a medical question → refusal + redirect, no tool fabrication,
- SLOT_TAKEN from the tool → model offers alternatives,
- handoff trigger → conversation.needsHuman = true and aiPaused set appropriately.

Acceptance: typecheck, lint, tests pass.
```

**✅ What to expect after running**
- A working AI orchestrator that assembles tenant‑scoped context, runs an OpenAI tool loop, and updates the conversation FSM.
- Tools wired to real services (availability/booking/FAQ/handoff); the model can only mutate data via tools.
- Guardrails enforcing medical refusal, no fabrication, and human escalation — all covered by tests against a mocked model.

**Verify:** Run the AI tests with the mocked client; confirm the booking and refusal scenarios behave per spec. (No real OpenAI calls needed to pass.)

**Commit:** `feat(ai): orchestrator, tool schemas, guardrails, conversation FSM`

---

# PHASE 8 — WhatsApp outbound + confirmations

### Prompt 8 — Sender, delivery tracking, 24‑hour window, confirmation message

```text
Implement Build Order Step 8 (Section 37) per Sections 10.2, 28, and 9.

integrations/whatsapp.ts (outbound side):
- sendText(tenant, toWaId, body): POST to graph.facebook.com/{phoneNumberId}/messages
  using the tenant's access token from the secret store (Section 28.1). Store the returned
  WhatsApp message id on the message document.
- Respect the 24-hour customer-service window (Section 10.2): free-form replies only within
  24h of the patient's last inbound message; outside it, send an approved template
  (confirmation/reminder) instead.
- Retry on transient 429/5xx with exponential backoff + jitter (Section 15.4); mark messages
  failed after exhausting retries and surface them for staff (Section 14).

Delivery status:
- Handle WhatsApp status webhooks (sent/delivered/read/failed) and update the corresponding
  message.status (Sections 10.2, 20.9).

Booking confirmation (Section 9 / 12.4):
- On a successful booking, send a confirmation containing date, time, service, and clinic
  location, and set the conversation state to booked.

Tests against a mocked Graph API:
- successful send stores waMessageId and status=sent,
- transient failure retries then succeeds; permanent failure marks failed,
- status webhook updates message.status,
- outside-24h path uses a template, not free-form.

Acceptance: typecheck, lint, tests pass.
```

**✅ What to expect after running**
- An outbound sender with delivery tracking, retry/backoff, failure surfacing, and 24‑hour‑window handling.
- Automated booking confirmations with date/time/service/location.
- Tests against a mocked Graph API for send, retry, status updates, and the template path.

**Verify:** Run outbound tests; confirm a booked appointment triggers a confirmation message record with a `waMessageId`.

**Commit:** `feat(whatsapp): outbound sender, delivery tracking, 24h window, confirmations`

---

# PHASE 9 — End‑to‑end conversation wiring

### Prompt 9 — Connect inbound → AI → outbound and validate the full loop

```text
Implement Build Order Step 9 (Section 37). Connect the pieces from Phases 6–8 into one loop
per Sections 8 and 10.

- In the inbound worker (Phase 6), when conversation.aiPaused is false, invoke the AI
  orchestrator (Phase 7) and send its reply via the outbound sender (Phase 8). Debounce
  rapid consecutive messages into a single AI turn (Section 14).
- If conversation.needsHuman/aiPaused becomes true, do NOT auto-reply; record a staff
  notification instead (Section 12.3).
- Ensure the whole path is idempotent and logged with conversationId + requestId
  (Sections 15, 29).

Write an END-TO-END test (emulator + mocked OpenAI + mocked Graph API) simulating a real
conversation per Section 8.1:
  greeting → FAQ answer → booking intent → availability → slot selection →
  transactional booking → confirmation message.
Assert: an appointment exists, a confirmation message was "sent", and the conversation
state is "booked".

Also add the double-booking race E2E from Section 31.3 at the conversation level (two
patients targeting the same slot → exactly one confirmation, the other offered alternatives).

Acceptance: typecheck, lint, all unit/integration/E2E tests pass.
```

**✅ What to expect after running**
- The complete server‑side conversation loop: a simulated patient message flows through AI and produces a real booking + confirmation.
- Debouncing, human‑handoff suppression, and full correlation logging.
- A passing end‑to‑end test mirroring Section 8.1, plus a conversation‑level race test.

**Verify:** Run the E2E suite. This is your first "the product actually works" milestone (still without UI).

**Commit:** `feat(core): wire inbound→AI→outbound end-to-end with E2E tests`

---

# PHASE 10 — Dashboard scaffolding & auth UI

### Prompt 10 — Next.js shell, Firebase Auth login, protected layout, API client

```text
Implement the first part of Build Order Step 10 (Section 37) per Sections 24–26.

In apps/web:
- Set up Firebase Auth on the client (email/password; Google optional). Add /login.
- A typed API client (lib/api) that attaches the Firebase ID token as a Bearer header to
  every request and parses the standard error envelope (Section 15).
- A protected (dash) route group with AppShell: Sidebar + Topbar (current user/tenant,
  sign-out). AuthGuard redirects unauthenticated users to /login; expose useAuth().
- Use TanStack Query for server state. Tailwind + a small accessible component set
  (shadcn/ui) for primitives (Button, Card, Table, Dialog, Toast) — WCAG 2.1 AA for key
  flows (Section 6).
- Implement the routing map skeleton from Section 24.1 (empty pages for dashboard,
  appointments, conversations, patients, settings/*; admin/tenants gated to platform_admin).
- Wire the home page to call GET /api/me and show the tenant + role.

Acceptance: web app builds; login works against the Auth emulator/real project;
authenticated user sees the shell with their tenant/role; unauthenticated users are
redirected to /login. typecheck + lint pass.
```

**✅ What to expect after running**
- A styled, accessible dashboard shell with working Firebase login and a protected layout.
- A typed API client that injects the token and handles the error envelope.
- All dashboard routes scaffolded (empty) per Section 24.1; home shows the current tenant/role from `/api/me`.

**Verify:** Log in, confirm redirect behavior, and that `/api/me` data renders. Run `pnpm --filter web build`.

**Commit:** `feat(web): dashboard shell, firebase auth login, protected layout, api client`

---

# PHASE 11 — Dashboard: appointments & calendar

### Prompt 11 — Calendar/list view, create/reschedule/cancel, walk‑ins

```text
Continue Build Order Step 10 (Section 37). Build the Appointments and Dashboard-home
features per Sections 25–26.

- Dashboard home (/dashboard): today's appointments, KPI StatCards (upcoming, pending,
  cancellations), and an alert showing the needs-human conversation count.
- Appointments page: a CalendarView (day/week) + list with filters by date/status/service
  (consume GET /api/appointments). Clicking an item opens AppointmentDialog.
- AppointmentDialog: create a booking (including manual walk-ins), reschedule, cancel, and
  mark no-show — consuming GET /api/availability and the appointments endpoints. Manual
  bookings MUST go through the same transactional API (so double-booking rules still apply).
- Optimistic updates via TanStack Query with rollback on error; show the server error
  envelope message on 409 SLOT_TAKEN and offer to pick another slot.

Acceptance: a staff user can view today's calendar, create a walk-in, reschedule, cancel,
and mark no-show; a slot conflict surfaces a clear message; typecheck + lint pass. Add a
Playwright test for: login → view calendar → create a booking → see it on the calendar.
```

**✅ What to expect after running**
- A functional home dashboard with KPIs and a needs‑human alert.
- A calendar/list appointments view with create/reschedule/cancel/no‑show, all going through the safe booking API.
- Clear conflict handling and a passing Playwright happy‑path test.

**Verify:** Run the Playwright test; manually create a walk‑in and confirm it respects double‑booking.

**Commit:** `feat(web): dashboard home + appointments calendar and management`

---

# PHASE 12 — Dashboard: conversations & takeover

### Prompt 12 — Live inbox, transcript, take over / resume AI

```text
Continue Build Order Step 10 (Section 37). Build the Conversations experience per
Sections 8.3, 11, 25–26.

- ConversationList: live inbox (GET /api/conversations, filter by ?state) with status
  badges (needs human, AI paused, state). Use Firestore client listeners (scoped by rules)
  or polling for near-real-time updates.
- ConversationThread: render the message transcript (GET /api/conversations/:id/messages),
  message bubbles by author (patient/ai/staff), and a staff composer
  (POST /api/conversations/:id/messages) that sends via the same outbound service.
- Take over / Resume AI toggle (PATCH /api/conversations/:id { aiPaused }): when paused, the
  AI does not auto-reply (verify against Phase 9 behavior). Show a clear "AI paused" state.

Acceptance: staff can watch a live thread, take over (AI stops auto-replying), send a manual
reply that reaches the patient via WhatsApp, and resume AI. typecheck + lint pass. Add a
Playwright test for take-over → manual reply → resume.
```

**✅ What to expect after running**
- A live conversation inbox with status badges and a readable transcript.
- Staff manual replies (sent through the real outbound path) and a working take‑over/resume‑AI toggle.
- A Playwright test covering the takeover flow.

**Verify:** With the AI loop running (mocked), take over a conversation and confirm auto‑replies stop, then resume and confirm they return.

**Commit:** `feat(web): live conversations inbox, transcript, staff takeover`

---

# PHASE 13 — Dashboard: patients, settings, FAQs

### Prompt 13 — Patient management and clinic configuration UIs

```text
Finish Build Order Step 10 (Section 37). Build the remaining dashboard pages per
Sections 25–26.

- Patients: PatientTable with search (GET /api/patients?q), PatientDetail panel with
  booking history (GET /api/patients/:id), create/edit forms.
- Settings → Profile: working-hours editor (per-day open/close ranges), timezone, locale,
  location, slotLengthMinutes, bufferMinutes, minLeadTimeMinutes, holidays — saved via
  PUT /api/settings. Validate with the shared zod schemas.
- Settings → Services: list with duration + fee (integer minor units + currency); add/edit/
  deactivate via /api/services.
- Settings → FAQs: FaqEditor CRUD with tags via /api/faqs.

All forms: client + server validation, optimistic update where safe, accessible labels,
clear error display from the error envelope. Owner-only pages must be gated by role
(Section 18) and also enforced server-side.

Acceptance: an owner can fully configure the clinic (hours/services/fees/FAQs) and those
changes are reflected in the AI's answers/availability on the next message; staff are
correctly restricted; typecheck + lint pass. Add a Playwright test: edit a FAQ → verify it
persists.
```

**✅ What to expect after running**
- Complete patient management plus all clinic‑configuration screens (profile/hours, services/fees, FAQs).
- Role‑gated owner pages (enforced on client and server).
- Config changes take effect on the next conversation; a passing FAQ‑edit Playwright test.

**Verify:** As an owner, change working hours, then confirm availability reflects it; as staff, confirm the profile page is blocked. The dashboard (Step 10) is now complete.

**Commit:** `feat(web): patients, settings (profile/hours/services), FAQ management`

---

# PHASE 14 — Logging, monitoring, error tracking

### Prompt 14 — Structured logs, health, error tracking, alerts

```text
Implement Build Order Step 11 (Section 37) per Sections 29–30.

- Replace ad-hoc logging with structured JSON logging (pino) carrying requestId, tenantId,
  and (for AI turns) conversationId. Log the events listed in Section 29.1 at the specified
  levels. Redact secrets and avoid logging raw message bodies/phone numbers in plaintext
  (hash where full text isn't needed).
- Health/readiness endpoints for the API; ensure the webhook path stays fast.
- Integrate Sentry (frontend + backend) with release + tenant tags (Section 30.1).
- Emit the monitoring signals/metrics in Section 30 (latency, 5xx rate, queue depth/DLQ,
  WhatsApp send failure rate, AI error rate, booking conflicts, per-tenant usage). Provide a
  README section describing alert thresholds (Section 30) and where to configure uptime
  monitoring.

Acceptance: logs are structured and correlated; Sentry captures a forced test error with
tags; health endpoints respond; typecheck + lint + tests pass.
```

**✅ What to expect after running**
- Structured, correlated JSON logs with redaction and the spec's event taxonomy.
- Sentry wired with release/tenant tags; health endpoints; emitted metrics + documented alert thresholds.

**Verify:** Trigger a test error and confirm it appears in Sentry with tenant tags; tail logs and confirm `requestId`/`tenantId` are present.

**Commit:** `feat(observability): structured logging, health, sentry, metrics + alerts`

---

# PHASE 15 — Hardening & multi‑tenant verification

### Prompt 15 — Rate limiting, audit logs, second tenant, isolation tests

```text
Implement Build Order Step 12 (Section 37) per Sections 16, 18, 33–34.

- Rate limiting: per-IP and per-tenant limits on public + API routes; return 429
  RATE_LIMITED with backoff guidance (Sections 15.3, 16).
- Audit logging: write an immutable auditLogs entry (actorUid, role, action, target, at)
  for every staff mutation (Sections 16, 20.11).
- Onboarding flow: implement the platform-admin endpoints in Section 21.7
  (POST /api/admin/tenants, PATCH /api/admin/tenants/:id, GET /api/admin/health) and the
  onboarding steps in Section 33.3. Add an /(admin)/tenants UI gated to platform_admin.
- Seed a SECOND tenant ("clinic_b") and write cross-tenant ISOLATION tests proving a
  clinic_a user/token cannot read or write ANY clinic_b data via API, repository, or
  Firestore rules (Section 36.4).
- Apply scalability measures from Section 34 where cheap now: cache tenant settings +
  phone-number mapping (short TTL), paginate large lists, add TTL/cleanup for
  webhookEvents idempotency records.

Acceptance: rate limits enforced; every staff mutation produces an audit log; a second
tenant can be onboarded and operates in full isolation (tests prove it); typecheck + lint +
all tests pass.
```

**✅ What to expect after running**
- Per‑IP/per‑tenant rate limiting, immutable audit logs on staff mutations, and the platform‑admin onboarding (API + UI).
- A live **second tenant** plus passing cross‑tenant isolation tests at every layer.
- Cheap scalability wins (caching, pagination, idempotency TTL).

**Verify:** Run the isolation test suite (it must prove Clinic A ↔ Clinic B separation). Onboard Clinic B end‑to‑end via the admin flow.

**Commit:** `feat(hardening): rate limits, audit logs, multi-tenant onboarding + isolation tests`

---

# PHASE 16 — CI/CD & deployment

### Prompt 16 — Pipelines, Vercel + Railway + Firebase, smoke tests

```text
Implement Build Order Step 13 (Section 37) per Section 32.

- CI (GitHub Actions): on PR run install → typecheck → lint → unit + integration tests
  against the Firebase emulator suite (Section 31.4). Block merge on failure.
- CD: on merge to main, deploy apps/web to Vercel and apps/api (+ worker) to Railway; run
  smoke tests against /api/health and a minimal authenticated path. Deploy/publish
  firestore.rules and firestore.indexes.json.
- Environments: configure local / staging / production (Section 32.1). All secrets via
  platform env settings — never committed. Ensure .env.example documents every variable
  (Section 32.3).
- Document the WhatsApp webhook configuration for staging/production (verify token, callback
  URL) and the OpenAI/WhatsApp env wiring.

Acceptance: green CI on a PR; a successful staging deploy with passing smoke tests; rules +
indexes deployed; a documented runbook in README for promoting to production.
```

**✅ What to expect after running**
- A CI pipeline (typecheck/lint/test on emulators) gating merges, and CD to Vercel + Railway with post‑deploy smoke tests.
- Deployed Firestore rules/indexes, configured environments, and a documented webhook + secrets runbook.

**Verify:** Open a PR and confirm CI runs; trigger a staging deploy and confirm `/api/health` smoke test passes.

**Commit:** `ci: pipelines + staging/production deploy (vercel, railway, firebase)`

---

# PHASE 17 — Final acceptance & go‑live

### Prompt 17 — Validate every acceptance criterion and produce a go‑live checklist

```text
Final pass. Validate the system against the Acceptance Criteria in Section 36 and produce a
go-live report.

For EACH criterion in Sections 36.1–36.5, state PASS/FAIL with the test or manual step that
proves it, including:
- webhook signature verification + <200ms ack + dedupe,
- FAQ answers only from clinic data; medical-advice refusal,
- no slot/price presented that a tool didn't return,
- availability honors hours/buffers/lead-time; concurrent booking → one winner,
- confirmation message contents,
- dashboard login, calendar, takeover, FAQ edit,
- cross-tenant isolation (A cannot access B),
- audit logging of staff mutations,
- p95 AI reply < 6s in staging; uptime check green; structured logs with tenant+request ids.

Then produce GO_LIVE_CHECKLIST.md covering: a real WhatsApp test number verified end-to-end
in staging, approved message templates submitted, secrets set in production, monitoring +
alerts live, rate limits configured, backup/retention noted, and a rollback plan.

Fix any FAIL you find (smallest change that satisfies the criterion + a regression test),
then re-run the full suite. Report final status.
```

**✅ What to expect after running**
- A criterion‑by‑criterion PASS/FAIL report tied to real tests/steps, with any failures fixed and regression‑tested.
- A `GO_LIVE_CHECKLIST.md` you can execute to launch the first real clinic.

**Verify:** Read the report; ensure every MUST criterion is PASS and the full suite is green in staging with a real WhatsApp test number.

**Commit:** `chore: acceptance validation + go-live checklist`

---

## Appendix A — Reusable correction prompts

Keep these handy while driving the agent:

- **Drift / over-building:** *"Stop. Re-read Prompt 0 constraints and spec Section <n>. Do only what the current prompt asks. Remove anything extra."*
- **Skipped tests:** *"This isn't done until tests + typecheck + lint pass. Add the tests specified in the prompt, run them, and paste the results."*
- **Tenant-scope slip:** *"You read/wrote data without tenant scoping or trusted a client-supplied tenantId. Fix: derive tenantId from verified claims (or phone_number_id for webhooks) and scope all access. Add a test proving isolation."*
- **Layering violation:** *"A controller/component is touching Firestore or business logic directly. Move it: controller→service→repository. Only repositories touch Firestore."*
- **Booking safety slip:** *"Booking must occur inside a transaction that re-checks the interval and throws SLOT_TAKEN on conflict (spec 9.3). Add the concurrency test."*
- **Secret leak:** *"A secret/key is in code or the client bundle. Move it to env, add it to .env.example, and read it server-side only."*

## Appendix B — Suggested commit/branch flow
- One branch per phase: `feat/phase-05-booking`.
- Conventional Commits (the commit line is given in each phase).
- Open a PR per phase so CI runs; merge only on green.

## Appendix C — Phase → spec section map (quick reference)

| Phase | Build-order step (Sec 37) | Primary spec sections |
|------:|---------------------------|------------------------|
| 0 | — | 22–24, 28, 33, 37, 38 |
| 1 | 1 | 23, 32.3, 38 |
| 2 | 2 | 19, 20, 33 |
| 3 | 3 | 15–18, 33 |
| 4 | 4 | 18, 20, 21 |
| 5 | 5 | 9, 14, 21.3 |
| 6 | 6 | 10, 21.2, 28 |
| 7 | 7 | 12, 13, 27 |
| 8 | 8 | 9, 10.2, 28 |
| 9 | 9 | 8, 10, 31.3 |
| 10–13 | 10 | 24, 25, 26, 18 |
| 14 | 11 | 29, 30 |
| 15 | 12 | 16, 18, 33, 34 |
| 16 | 13 | 31.4, 32 |
| 17 | — | 36 |
