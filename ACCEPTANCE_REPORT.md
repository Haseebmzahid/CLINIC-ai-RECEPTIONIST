# Clinic AI Receptionist Acceptance Report

Date: 2026-06-17
Scope: Prompt 17 final acceptance pass against SRS Section 36.1-36.5.

The MVP acceptance definition says all MUST criteria must pass in staging with a real WhatsApp test number. This report records the current code/test evidence and the remaining staging proof required before production launch.

## Summary

| Section | Criterion                                                                                             | Status                                                       | Evidence                                                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 36.1    | Webhook verifies signatures and acks within 200ms; invalid signatures rejected.                       | PASS, automated; staging proof required                      | `apps/api/test/whatsapp-webhook.test.ts` verifies handshake token, valid `X-Hub-Signature-256`, invalid signature rejection, and now asserts POST ack latency `<200ms`.                                                                                |
| 36.1    | Inbound messages are persisted and grouped per patient/tenant; duplicates ignored.                    | PASS, automated; staging proof required                      | `apps/api/test/whatsapp-webhook.test.ts` persists patient/conversation/message under tenant and proves duplicate provider message IDs create one message/event.                                                                                        |
| 36.1    | Outbound replies are delivered and status-tracked.                                                    | PASS, automated; staging proof required                      | `apps/api/test/whatsapp-outbound.test.ts` covers Graph send, retry/backoff, template fallback, status callback updates, and failed status escalation.                                                                                                  |
| 36.2    | Greets new patients and identifies intent.                                                            | PASS, automated; staging proof required                      | `apps/api/test/conversation-e2e.test.ts` covers greeting, FAQ intent, booking intent, slot selection, and confirmation flow with mocked AI/WhatsApp.                                                                                                   |
| 36.2    | Answers FAQs only from clinic data; declines medical advice with safe redirect.                       | PASS, automated; staging proof required                      | `apps/api/test/conversation-e2e.test.ts` answers FAQ via seeded FAQ repository; `apps/api/test/ai-orchestrator.test.ts` refuses medical advice and avoids model calls.                                                                                 |
| 36.2    | Never presents a slot or price not returned by a tool.                                                | PASS, automated; staging proof required                      | `apps/api/test/ai-orchestrator.test.ts` and `apps/api/test/conversation-e2e.test.ts` drive booking through `get_availability` tool results and use service repository data for prices. Prompt/tool guardrails require deterministic values from tools. |
| 36.3    | Availability reflects hours, buffers, lead time, and existing bookings.                               | PASS, automated; staging proof required                      | `apps/api/test/availability.unit.test.ts` covers slot generation rules; `apps/api/test/booking-emulator.test.ts` covers existing booking blocking and reopening after cancellation.                                                                    |
| 36.3    | Concurrent booking of one slot yields exactly one success; other gets `SLOT_TAKEN` plus alternatives. | PASS, automated; staging proof required                      | `apps/api/test/booking-emulator.test.ts` proves one `201` and one `409 SLOT_TAKEN`; `apps/api/test/conversation-e2e.test.ts` proves one confirmation and one alternatives message in a conversation race.                                              |
| 36.3    | Confirmation message with date/time/service/location is sent on success.                              | PASS, automated; staging proof required                      | `apps/api/test/whatsapp-outbound.test.ts` asserts confirmation text includes service, location, date, and time and marks conversation booked.                                                                                                          |
| 36.4    | Staff can log in, see today's calendar, take over a conversation, and edit FAQs.                      | PASS, automated UI smoke; staging proof required             | `apps/web/e2e/appointments.spec.ts`, `apps/web/e2e/conversations.spec.ts`, and `apps/web/e2e/faqs.spec.ts` cover dashboard calendar, takeover/reply/resume, and FAQ edit with auth/API mocks. Manual staging Firebase login remains required.          |
| 36.4    | Clinic A user cannot read/write Clinic B data.                                                        | PASS, automated; staging proof required                      | `apps/api/test/auth.test.ts`, `apps/api/test/core-domain.test.ts`, `apps/api/test/repository-emulator.test.ts`, and `apps/api/test/hardening.test.ts` cover token tenant derivation, API isolation, repository isolation, and Firestore rule checks.   |
| 36.4    | All staff mutations appear in audit log.                                                              | PASS, automated; staging proof required                      | `apps/api/test/hardening.test.ts` proves staff service mutation writes tenant-scoped `auditLogs`; mutation controllers call `AuditLogService.recordStaffMutation`.                                                                                     |
| 36.5    | p95 AI reply < 6s in staging.                                                                         | FAIL until measured in staging                               | Code emits metrics and AI flow tests pass locally, but no real staging load/latency sample has been run in this workspace. Execute the staging measurement in `GO_LIVE_CHECKLIST.md`.                                                                  |
| 36.5    | API uptime check green.                                                                               | FAIL until uptime monitor is configured and green in staging | `/api/health` and `/api/health/ready` are implemented and tested in `apps/api/test/health.test.ts`, but external uptime monitoring must be configured and observed.                                                                                    |
| 36.5    | Structured logs present with tenant and request IDs.                                                  | PASS, automated/local; staging log-drain proof required      | `apps/api/src/middleware/request-context.ts` attaches `requestId` and tenant context; `apps/api/test/health.test.ts` covers health endpoints and metrics. Verify Railway log drain in staging.                                                         |

## Required Staging Validation

Before production, run these manual checks in staging with the real Meta WhatsApp test number:

1. Send an inbound WhatsApp message through Meta to `/api/webhooks/whatsapp`; confirm HTTP 200 ack, signature validation, persisted patient/conversation/message, and no duplicate on resend.
2. Complete greeting, FAQ, booking, and confirmation through WhatsApp. Confirm the reply uses clinic FAQ/service/location data only.
3. Ask for medical advice and confirm the assistant refuses and escalates to staff.
4. Attempt a race on one slot and confirm one booking succeeds while the other gets alternatives.
5. Log into the dashboard with Firebase Auth, view calendar, take over/resume a conversation, edit an FAQ, and confirm audit logs.
6. Log in as Clinic A and confirm Clinic B records are inaccessible through API and dashboard.
7. Capture staging AI reply latency and confirm p95 < 6 seconds.
8. Confirm uptime monitor is green and structured Railway logs include `requestId` plus tenant context.

## Verification Run

Local verification run on 2026-06-17:

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS
- `pnpm build`: PASS
- `pnpm --filter web e2e`: PASS

Note: Local `pnpm test` skips emulator-gated tests unless `FIRESTORE_EMULATOR_HOST` is set. CI is configured to run those tests under Firebase emulators.
