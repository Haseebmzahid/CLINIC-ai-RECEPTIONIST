# Go-Live Checklist

Use this checklist for the first real clinic launch. Do not promote to production until every required item is checked.

## Staging Proof

- [ ] Staging Firebase project exists with Firestore and Firebase Auth enabled.
- [ ] Firestore rules and indexes deployed to staging.
- [ ] Staging Railway API deployed and `/api/health` plus `/api/health/ready` return `ok`.
- [ ] Staging Vercel dashboard deployed and points to the staging API.
- [ ] Real Meta WhatsApp test number is connected to staging.
- [ ] Meta webhook callback is set to `https://<staging-api-host>/api/webhooks/whatsapp`.
- [ ] Webhook verify token matches staging `WHATSAPP_VERIFY_TOKEN`.
- [ ] Inbound WhatsApp message completes greeting, FAQ, booking, and confirmation end to end.
- [ ] Duplicate inbound webhook event is ignored by provider message ID.
- [ ] Status callback updates outbound message delivery/read/failed state.
- [ ] Medical-advice request is refused and escalates to staff.
- [ ] Dashboard login, calendar, conversation takeover/resume, patient search, and FAQ edit are verified in staging.
- [ ] Clinic A user cannot read or write Clinic B data via API or dashboard.
- [ ] Staff mutations produce `auditLogs` entries.
- [ ] AI reply p95 is below 6 seconds over a representative staging sample.

## Templates And Messaging

- [ ] WhatsApp Business account is approved.
- [ ] Production phone number is verified.
- [ ] `appointment_confirmation` template is submitted and approved.
- [ ] Template language matches `WHATSAPP_TEMPLATE_LANGUAGE`.
- [ ] 24-hour-window behavior verified: free-form replies inside the window, template fallback outside it.

## Production Secrets

- [ ] Railway production `NODE_ENV=production`.
- [ ] Railway production `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` set.
- [ ] Railway production `OPENAI_API_KEY` and `OPENAI_MODEL` set.
- [ ] Railway production WhatsApp variables set: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_CONFIRMATION_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE`.
- [ ] Railway production `ALLOWED_ORIGIN` points to production Vercel origin.
- [ ] Railway production `APP_BASE_URL` points to production API host.
- [ ] Vercel production Firebase public config set.
- [ ] Vercel production `NEXT_PUBLIC_API_BASE_URL` points to production API.
- [ ] Sentry DSNs and release/environment variables set for API and web.
- [ ] GitHub production environment secrets set for Vercel, Railway, Firebase, and smoke tests.
- [ ] No secrets are present in git history, client bundles, logs, or `.env.example` values.

## Monitoring And Alerts

- [ ] Uptime monitor checks `/api/health` and `/api/health/ready`.
- [ ] Alert configured for API down longer than 1 minute.
- [ ] Alert configured for AI reply p95 above 6 seconds before launch and above 8 seconds for sustained production degradation.
- [ ] Alert configured for 5xx rate above 2% for 5 minutes.
- [ ] Alert configured for webhook queue backlog rising or DLQ greater than 0.
- [ ] Alert configured for WhatsApp send failure rate above 5%.
- [ ] Alert configured for OpenAI error/timeout rate above 5%.
- [ ] Alert configured for sudden booking-conflict spikes.
- [ ] Railway logs are structured JSON and searchable by `requestId` and `tenantId`.
- [ ] Sentry events include release, tenant, role, and request tags.

## Rate Limits And Security

- [ ] Production `PUBLIC_RATE_LIMIT_WINDOW_MS` and `PUBLIC_RATE_LIMIT_MAX` configured.
- [ ] Production `TENANT_RATE_LIMIT_WINDOW_MS` and `TENANT_RATE_LIMIT_MAX` configured.
- [ ] CORS allowlist is production-only.
- [ ] Firebase custom claims set for first clinic owner/staff users.
- [ ] Platform admin accounts are limited and reviewed.
- [ ] WhatsApp webhook signature validation verified in production dry run.

## Backup, Retention, And Operations

- [ ] Firestore backup/export policy documented in Firebase or Google Cloud.
- [ ] Audit log retention policy documented.
- [ ] Webhook idempotency TTL policy documented and reviewed.
- [ ] Patient data deletion/export process documented for operator handling.
- [ ] On-call owner and escalation path documented.

## Production Promotion

- [ ] Merge to `main` with green CI.
- [ ] Confirm staging deploy workflow passed.
- [ ] Dispatch production deployment workflow.
- [ ] Confirm production smoke tests pass.
- [ ] Configure production Meta webhook callback: `https://<production-api-host>/api/webhooks/whatsapp`.
- [ ] Send one production test conversation from the approved number.
- [ ] Confirm uptime monitor and Sentry are green after launch.

## Rollback Plan

- [ ] Identify last known-good git commit.
- [ ] Roll back Vercel to the previous production deployment.
- [ ] Redeploy previous Railway service version or deploy from the last known-good commit.
- [ ] Redeploy last known-good Firestore rules and indexes from git.
- [ ] Disable Meta webhook or point it back to staging if production messaging is unsafe.
- [ ] Notify clinic staff and route conversations to human takeover until service is stable.
