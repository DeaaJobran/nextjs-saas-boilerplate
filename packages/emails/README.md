# Emails and notifications

`@nextjs-saas/emails` is the queue-backed messaging module for transactional email, in-app notifications, push hooks, SMS hooks, user preferences, and delivery auditability.

## Delivery flow

`createMessagingService()` persists every email request in `message_deliveries` and enqueues a background job in the same database transaction. The shared worker renders and sends the message, records the provider message ID, and updates delivery status and audit events. Provider failures are retained on the delivery record and are retried through the background-job attempt policy.

The worker also dispatches `auth.notification` outbox events emitted by the authentication package. Outbox IDs become tenant-scoped delivery idempotency keys, preventing duplicate queue records and concurrent sends. Delivery is at least once: if a process exits after a provider accepts a message but before the sent state is persisted, a retry can submit it again. Authentication emails are required transactional messages; ordinary product events respect the user’s email preference.

## React Email templates and localization

Templates are React components rendered with `@react-email/render`. The default registry includes English LTR and Arabic RTL authentication messages and a generic transactional template. Callers can inject another `EmailTemplateRenderer` to add product-specific templates without changing the delivery service.

Brand name, accent color, logo, sender, and support address come from runtime configuration or a per-delivery tenant brand object. User-facing content and links come from localized template data and the queued payload rather than provider-specific code.

## Email providers

Set `EMAIL_PROVIDER` to one of:

- `preview`: writes HTML, text, and envelope metadata under `EMAIL_PREVIEW_DIR` without external delivery.
- `smtp`: uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and optional `SMTP_USER`/`SMTP_PASSWORD`. The local Docker Compose Mailpit service is available at SMTP port 1025 and web port 8025.
- `resend`: uses `RESEND_API_KEY` and optional `RESEND_API_BASE_URL`.
- `postmark`: uses `POSTMARK_SERVER_TOKEN` and optional `POSTMARK_API_BASE_URL`.
- `mailgun`: uses `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and optional `MAILGUN_API_BASE_URL`.

The module exposes provider contracts and factories separately from the queue service. Provider secrets remain in environment or secret storage and are not persisted in delivery records.

## Preferences and notification channels

Preferences are scoped to a user, optional tenant, and event type. An exact event preference overrides the wildcard `*` preference. Email, in-app, push, and SMS choices are applied by the corresponding service methods. SMS is opt-in by default; push, email, and in-app delivery are enabled by default where applicable.

In-app notifications support tenant-scoped listing, read state, dismissal, metadata, and action URLs. Push and SMS are provider abstractions so downstream projects can connect APNs/FCM or an SMS vendor without coupling those services to email delivery. The web settings page exposes localized channel preferences and an inbox; the admin overview exposes delivery status without rendering sensitive message payloads.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/emails test
pnpm --filter @nextjs-saas/emails typecheck
pnpm --filter @nextjs-saas/db test
pnpm --filter @nextjs-saas/web typecheck
```

Tests cover localized React rendering, preview output, HTTP provider adapters, runtime provider selection, queue/idempotency behavior, retries, auth-outbox dispatch, preferences, in-app state, audit records, and migration parity.
