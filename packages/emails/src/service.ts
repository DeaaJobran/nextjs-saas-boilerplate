import { randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";

import { defaultEmailTemplateRenderer } from "./renderer";
import type {
  EmailAddress,
  EmailProvider,
  EmailTemplateRenderer,
  InAppNotification,
  MessageBrand,
  MessageDelivery,
  MessageLocale,
  NotificationPreference,
  PushProvider,
  SmsProvider,
} from "./types";

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (transaction: Queryable) => Promise<T>): Promise<T>;
};

type MessagingServiceOptions = {
  brand: MessageBrand;
  client?: Queryable;
  emailProvider: EmailProvider;
  from: EmailAddress;
  now?: () => Date;
  pushProvider?: PushProvider;
  renderer?: EmailTemplateRenderer;
  smsProvider?: SmsProvider;
};

type DeliveryRow = {
  attempts: number;
  brand: MessageBrand | string;
  channel: "email" | "in_app" | "push" | "sms";
  created_at: Date | string;
  event_type: string;
  failed_at: Date | string | null;
  id: string;
  last_error: string | null;
  locale: string;
  max_attempts: number;
  payload: Record<string, unknown> | string;
  provider: string;
  provider_message_id: string | null;
  recipient: string;
  sent_at: Date | string | null;
  status: "failed" | "queued" | "sending" | "sent" | "suppressed";
  subject: string | null;
  template_key: string;
  tenant_id: string | null;
  updated_at: Date | string;
  user_id: string | null;
};

type PreferenceRow = {
  email_enabled: boolean;
  event_type: string;
  in_app_enabled: boolean;
  locale: string | null;
  push_enabled: boolean;
  sms_enabled: boolean;
  tenant_id: string | null;
  updated_at: Date | string;
  user_id: string;
};

type NotificationRow = {
  action_url: string | null;
  body: string;
  created_at: Date | string;
  dismissed_at: Date | string | null;
  event_type: string;
  id: string;
  metadata: Record<string, unknown> | string;
  read_at: Date | string | null;
  tenant_id: string | null;
  title: string;
  user_id: string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJson<T>(value: T | string, fallback: T): T {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDelivery(row: DeliveryRow): MessageDelivery {
  return {
    attempts: row.attempts,
    channel: row.channel,
    createdAt: toIso(row.created_at)!,
    eventType: row.event_type,
    failedAt: toIso(row.failed_at),
    id: row.id,
    lastError: row.last_error ?? undefined,
    locale: row.locale,
    maxAttempts: row.max_attempts,
    provider: row.provider,
    providerMessageId: row.provider_message_id ?? undefined,
    recipient: row.recipient,
    sentAt: toIso(row.sent_at),
    status: row.status,
    subject: row.subject ?? undefined,
    templateKey: row.template_key,
    tenantId: row.tenant_id ?? undefined,
    updatedAt: toIso(row.updated_at)!,
    userId: row.user_id ?? undefined,
  };
}

function toPreference(row: PreferenceRow): NotificationPreference {
  return {
    emailEnabled: row.email_enabled,
    eventType: row.event_type,
    inAppEnabled: row.in_app_enabled,
    locale: row.locale ?? undefined,
    pushEnabled: row.push_enabled,
    smsEnabled: row.sms_enabled,
    tenantId: row.tenant_id ?? undefined,
    updatedAt: toIso(row.updated_at)!,
    userId: row.user_id,
  };
}

function toNotification(row: NotificationRow): InAppNotification {
  return {
    actionUrl: row.action_url ?? undefined,
    body: row.body,
    createdAt: toIso(row.created_at)!,
    dismissedAt: toIso(row.dismissed_at),
    eventType: row.event_type,
    id: row.id,
    metadata: parseJson(row.metadata, {}),
    readAt: toIso(row.read_at),
    tenantId: row.tenant_id ?? undefined,
    title: row.title,
    userId: row.user_id,
  };
}

function validEmail(value: string) {
  for (const character of value) {
    if (!character.trim()) {
      return false;
    }
  }

  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) {
    return false;
  }

  const domain = value.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf(".");

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

export const messagingJobTypes = {
  dispatchOutbox: "messaging.outbox.dispatch",
  sendEmail: "messaging.email.send",
} as const;

export const messagingSchedules = [
  {
    id: "messaging-auth-outbox-dispatch",
    intervalSeconds: 30,
    jobType: messagingJobTypes.dispatchOutbox,
    name: "Dispatch queued messaging outbox events",
  },
] as const;

const deliveryClaimTimeoutMs = 5 * 60 * 1_000;
const outboxMaxAttempts = 3;

export function createMessagingService(options: MessagingServiceOptions) {
  const now = options.now ?? (() => new Date());
  const renderer = options.renderer ?? defaultEmailTemplateRenderer;

  async function getClient() {
    if (options.client) {
      await runMigrations(options.client);
      return options.client;
    }

    const runtime = await getDatabaseRuntime();
    await runMigrations(runtime);
    return runtime;
  }

  async function withTransaction<T>(
    client: Queryable,
    callback: (transaction: Queryable) => Promise<T>,
  ) {
    if (
      "transaction" in client &&
      typeof (client as Partial<TransactionalQueryable>).transaction ===
        "function"
    ) {
      return (client as TransactionalQueryable).transaction(callback);
    }

    return callback(client);
  }

  async function audit(
    client: Queryable,
    input: {
      actorId?: string;
      deliveryId?: string;
      eventType: string;
      payload?: Record<string, unknown>;
      tenantId?: string;
      userId?: string;
    },
  ) {
    await client.execute(
      `
        INSERT INTO messaging_audit_events (
          id, tenant_id, user_id, delivery_id, actor_id,
          event_type, payload, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        ON CONFLICT DO NOTHING
      `,
      [
        randomUUID(),
        input.tenantId ?? null,
        input.userId ?? null,
        input.deliveryId ?? null,
        input.actorId ?? null,
        input.eventType,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function ensureSentAudit(client: Queryable, delivery: DeliveryRow) {
    await audit(client, {
      deliveryId: delivery.id,
      eventType: "messaging.delivery.sent",
      payload: { provider: delivery.provider },
      tenantId: delivery.tenant_id ?? undefined,
      userId: delivery.user_id ?? undefined,
    });
  }

  async function getPreference(input: {
    eventType: string;
    tenantId?: string;
    userId: string;
  }) {
    const client = await getClient();
    const rows = await client.execute<PreferenceRow>(
      `
        SELECT *
        FROM notification_preferences
        WHERE user_id = $1
          AND tenant_id IS NOT DISTINCT FROM $2::text
          AND event_type IN ($3, '*')
        ORDER BY CASE WHEN event_type = $3 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [input.userId, input.tenantId ?? null, input.eventType],
    );

    return rows[0] ? toPreference(rows[0]) : undefined;
  }

  async function setPreference(input: {
    actorId?: string;
    emailEnabled: boolean;
    eventType: string;
    inAppEnabled: boolean;
    locale?: string;
    pushEnabled: boolean;
    smsEnabled: boolean;
    tenantId?: string;
    userId: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();

    return withTransaction(client, async (transaction) => {
      const rows = await transaction.execute<PreferenceRow>(
        `
          INSERT INTO notification_preferences (
            id, user_id, tenant_id, event_type, email_enabled,
            in_app_enabled, push_enabled, sms_enabled, locale,
            quiet_hours, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb, $10, $10)
          ON CONFLICT (user_id, (COALESCE(tenant_id, '')), event_type)
          DO UPDATE SET
            email_enabled = EXCLUDED.email_enabled,
            in_app_enabled = EXCLUDED.in_app_enabled,
            push_enabled = EXCLUDED.push_enabled,
            sms_enabled = EXCLUDED.sms_enabled,
            locale = EXCLUDED.locale,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          randomUUID(),
          input.userId,
          input.tenantId ?? null,
          input.eventType,
          input.emailEnabled,
          input.inAppEnabled,
          input.pushEnabled,
          input.smsEnabled,
          input.locale ?? null,
          timestamp,
        ],
      );

      await audit(transaction, {
        actorId: input.actorId,
        eventType: "messaging.preference.updated",
        payload: { eventType: input.eventType },
        tenantId: input.tenantId,
        userId: input.userId,
      });

      return toPreference(rows[0]!);
    });
  }

  async function listPreferences(input: { tenantId?: string; userId: string }) {
    const client = await getClient();
    const rows = await client.execute<PreferenceRow>(
      `
        SELECT *
        FROM notification_preferences
        WHERE user_id = $1
          AND tenant_id IS NOT DISTINCT FROM $2::text
        ORDER BY event_type
      `,
      [input.userId, input.tenantId ?? null],
    );

    return rows.map(toPreference);
  }

  async function queueEmail(input: {
    brand?: MessageBrand;
    eventType: string;
    idempotencyKey?: string;
    locale?: MessageLocale;
    maxAttempts?: number;
    payload: Record<string, unknown>;
    recipient: EmailAddress;
    templateKey: string;
    tenantId?: string;
    userId?: string;
  }) {
    if (!validEmail(input.recipient.email)) {
      throw new Error("A valid email recipient is required.");
    }

    const maxAttempts = input.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error("maxAttempts must be a positive integer.");
    }

    const preference = input.userId
      ? await getPreference({
          eventType: input.eventType,
          tenantId: input.tenantId,
          userId: input.userId,
        })
      : undefined;
    const locale = input.locale ?? preference?.locale ?? "en";
    const requiredDelivery =
      input.eventType.startsWith("auth.") ||
      input.eventType === "tenant.invitation.notification";
    const status =
      preference?.emailEnabled === false && !requiredDelivery
        ? "suppressed"
        : "queued";
    const client = await getClient();
    const timestamp = now().toISOString();

    return withTransaction(client, async (transaction) => {
      const deliveryId = randomUUID();
      const rows = await transaction.execute<DeliveryRow>(
        `
          INSERT INTO message_deliveries (
            id, tenant_id, user_id, channel, event_type, template_key,
            locale, recipient, provider, payload, brand, status, attempts,
            max_attempts, idempotency_key, queued_at, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, 'email', $4, $5, $6, $7, $8, $9::jsonb,
            $10::jsonb, $11, 0, $12, $13, $14, $14, $14
          )
          ON CONFLICT DO NOTHING
          RETURNING *
        `,
        [
          deliveryId,
          input.tenantId ?? null,
          input.userId ?? null,
          input.eventType,
          input.templateKey,
          locale,
          input.recipient.email,
          options.emailProvider.id,
          JSON.stringify({
            ...input.payload,
            recipientName: input.recipient.name,
          }),
          JSON.stringify(input.brand ?? options.brand),
          status,
          maxAttempts,
          input.idempotencyKey ?? null,
          timestamp,
        ],
      );
      const delivery = rows[0];

      if (!delivery) {
        if (!input.idempotencyKey) {
          throw new Error("Unable to create the message delivery.");
        }

        const existing = await transaction.execute<DeliveryRow>(
          `
            SELECT *
            FROM message_deliveries
            WHERE tenant_id IS NOT DISTINCT FROM $1::text
              AND idempotency_key = $2
            LIMIT 1
          `,
          [input.tenantId ?? null, input.idempotencyKey],
        );

        if (!existing[0]) {
          throw new Error("Unable to resolve the idempotent message delivery.");
        }

        return toDelivery(existing[0]);
      }

      if (status === "queued") {
        await transaction.execute(
          `
            INSERT INTO background_jobs (
              id, tenant_id, queue, type, payload, status, priority,
              attempts, max_attempts, available_at, created_at, updated_at
            )
            VALUES ($1, $2, 'default', $3, $4::jsonb, 'queued', 0, 0, $5, $6, $6, $6)
            ON CONFLICT (id) DO NOTHING
          `,
          [
            `message-delivery:${deliveryId}`,
            input.tenantId ?? null,
            messagingJobTypes.sendEmail,
            JSON.stringify({ deliveryId }),
            maxAttempts + 1,
            timestamp,
          ],
        );
      }

      await audit(transaction, {
        deliveryId,
        eventType:
          status === "suppressed"
            ? "messaging.delivery.suppressed"
            : "messaging.delivery.queued",
        payload: { channel: "email", eventType: input.eventType },
        tenantId: input.tenantId,
        userId: input.userId,
      });

      return toDelivery(delivery);
    });
  }

  async function processEmailDelivery(deliveryId: string) {
    const client = await getClient();
    const claimedAt = now();
    const claimed = await client.execute<DeliveryRow>(
      `
        UPDATE message_deliveries
        SET status = 'sending', attempts = attempts + 1,
            last_error = NULL, updated_at = $1
        WHERE id = $2
          AND channel = 'email'
          AND attempts < max_attempts
          AND (
            status IN ('queued', 'failed')
            OR (status = 'sending' AND updated_at <= $3)
          )
        RETURNING *
      `,
      [
        claimedAt.toISOString(),
        deliveryId,
        new Date(claimedAt.getTime() - deliveryClaimTimeoutMs).toISOString(),
      ],
    );
    const row = claimed[0];

    if (!row) {
      const existing = await client.execute<DeliveryRow>(
        "SELECT * FROM message_deliveries WHERE id = $1 LIMIT 1",
        [deliveryId],
      );
      const current = existing[0];

      if (!current) {
        throw new Error(`Message delivery not found: ${deliveryId}`);
      }

      if (current.channel !== "email") {
        throw new Error(`Delivery ${deliveryId} is not an email delivery.`);
      }

      if (current.status === "sent") {
        await ensureSentAudit(client, current);
        return toDelivery(current);
      }

      const staleBefore = new Date(
        claimedAt.getTime() - deliveryClaimTimeoutMs,
      ).toISOString();

      if (
        current.status === "sending" &&
        current.attempts >= current.max_attempts &&
        toIso(current.updated_at)! <= staleBefore
      ) {
        const message = "Email delivery timed out after its final attempt.";
        const failedAt = claimedAt.toISOString();
        const failed = await client.execute<DeliveryRow>(
          `
            UPDATE message_deliveries
            SET status = 'failed', last_error = $1,
                failed_at = $2, updated_at = $2
            WHERE id = $3
              AND status = 'sending'
              AND attempts >= max_attempts
              AND updated_at <= $4
            RETURNING *
          `,
          [message, failedAt, deliveryId, staleBefore],
        );

        if (failed[0]) {
          await audit(client, {
            deliveryId,
            eventType: "messaging.delivery.failed",
            payload: { error: message },
            tenantId: failed[0].tenant_id ?? undefined,
            userId: failed[0].user_id ?? undefined,
          });

          return toDelivery(failed[0]);
        }
      }

      if (current.status === "sending") {
        throw new Error(`Delivery ${deliveryId} is already being processed.`);
      }

      return toDelivery(current);
    }

    let sentDelivery: DeliveryRow;

    try {
      const payload = parseJson(row.payload, {});
      const brand = parseJson(row.brand, options.brand);
      const rendered = await renderer(row.template_key, payload, {
        brand,
        locale: row.locale,
      });
      const result = await options.emailProvider.send({
        ...rendered,
        from: options.from,
        tags: {
          event: row.event_type,
          ...(row.tenant_id ? { tenant: row.tenant_id } : {}),
        },
        to: [
          {
            email: row.recipient,
            name:
              typeof payload.recipientName === "string"
                ? payload.recipientName
                : undefined,
          },
        ],
      });

      if (!result.accepted) {
        throw new Error(`${result.provider} rejected the email delivery.`);
      }

      const completedAt = now().toISOString();
      const updated = await client.execute<DeliveryRow>(
        `
          UPDATE message_deliveries
          SET status = 'sent', provider_message_id = $1, subject = $2,
              sent_at = $3, failed_at = NULL, updated_at = $3
          WHERE id = $4
          RETURNING *
        `,
        [result.messageId, rendered.subject, completedAt, deliveryId],
      );
      sentDelivery = updated[0]!;
    } catch (error) {
      const failedAt = now().toISOString();
      const message = error instanceof Error ? error.message : String(error);

      await client.execute(
        `
          UPDATE message_deliveries
          SET status = 'failed', last_error = $1,
              failed_at = $2, updated_at = $2
          WHERE id = $3
        `,
        [message, failedAt, deliveryId],
      );
      await audit(client, {
        deliveryId,
        eventType: "messaging.delivery.failed",
        payload: { error: message },
        tenantId: row.tenant_id ?? undefined,
        userId: row.user_id ?? undefined,
      });

      throw error;
    }

    await ensureSentAudit(client, sentDelivery);

    return toDelivery(sentDelivery);
  }

  async function createInAppNotification(input: {
    actionUrl?: string;
    body: string;
    eventType: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
    title: string;
    userId: string;
  }) {
    const preference = await getPreference({
      eventType: input.eventType,
      tenantId: input.tenantId,
      userId: input.userId,
    });

    if (preference?.inAppEnabled === false) {
      return undefined;
    }

    const client = await getClient();
    const rows = await client.execute<NotificationRow>(
      `
        INSERT INTO in_app_notifications (
          id, tenant_id, user_id, event_type, title, body,
          action_url, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        RETURNING *
      `,
      [
        randomUUID(),
        input.tenantId ?? null,
        input.userId,
        input.eventType,
        input.title,
        input.body,
        input.actionUrl ?? null,
        JSON.stringify(input.metadata ?? {}),
        now().toISOString(),
      ],
    );

    await audit(client, {
      eventType: "messaging.in_app.created",
      payload: { eventType: input.eventType, notificationId: rows[0]!.id },
      tenantId: input.tenantId,
      userId: input.userId,
    });

    return toNotification(rows[0]!);
  }

  async function listInAppNotifications(input: {
    includeDismissed?: boolean;
    limit?: number;
    tenantId?: string;
    userId: string;
  }) {
    const client = await getClient();
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const rows = await client.execute<NotificationRow>(
      `
        SELECT *
        FROM in_app_notifications
        WHERE user_id = $1
          AND tenant_id IS NOT DISTINCT FROM $2::text
          AND ($3::boolean = true OR dismissed_at IS NULL)
        ORDER BY created_at DESC
        LIMIT $4
      `,
      [
        input.userId,
        input.tenantId ?? null,
        input.includeDismissed ?? false,
        limit,
      ],
    );

    return rows.map(toNotification);
  }

  async function updateInAppNotification(input: {
    action: "dismiss" | "read";
    notificationId: string;
    tenantId?: string;
    userId: string;
  }) {
    const client = await getClient();
    const column = input.action === "read" ? "read_at" : "dismissed_at";
    const rows = await client.execute<NotificationRow>(
      `
        UPDATE in_app_notifications
        SET ${column} = $1
        WHERE id = $2
          AND user_id = $3
          AND tenant_id IS NOT DISTINCT FROM $4::text
        RETURNING *
      `,
      [
        now().toISOString(),
        input.notificationId,
        input.userId,
        input.tenantId ?? null,
      ],
    );

    return rows[0] ? toNotification(rows[0]) : undefined;
  }

  async function listDeliveries(input: {
    limit?: number;
    tenantId?: string;
    userId?: string;
  }) {
    const client = await getClient();
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const rows = await client.execute<DeliveryRow>(
      `
        SELECT *
        FROM message_deliveries
        WHERE ($1::text IS NULL OR tenant_id = $1)
          AND ($2::text IS NULL OR user_id = $2)
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [input.tenantId ?? null, input.userId ?? null, limit],
    );

    return rows.map(toDelivery);
  }

  async function dispatchOutbox(limit = 25) {
    const client = await getClient();
    const events = await client.execute<{
      attempts: number;
      event_type: "auth.notification" | "tenant.invitation.notification";
      id: string;
      payload: Record<string, unknown> | string;
      tenant_id: string | null;
    }>(
      `
        SELECT id, tenant_id, event_type, attempts, payload
        FROM outbox_events
        WHERE event_type IN ('auth.notification', 'tenant.invitation.notification')
          AND status = 'queued'
          AND available_at <= $1
        ORDER BY created_at ASC
        LIMIT $2
      `,
      [now().toISOString(), Math.min(Math.max(limit, 1), 100)],
    );
    let dispatched = 0;

    for (const event of events) {
      try {
        const payload = parseJson(event.payload, {});
        const email = typeof payload.email === "string" ? payload.email : "";
        let userId =
          typeof payload.userId === "string" ? payload.userId : undefined;
        const isTenantInvitation =
          event.event_type === "tenant.invitation.notification";
        const kind = isTenantInvitation
          ? "invitation"
          : typeof payload.kind === "string"
            ? payload.kind
            : "auth";

        if (!validEmail(email)) {
          await client.execute(
            `
              UPDATE outbox_events
              SET status = 'failed', attempts = attempts + 1,
                  last_error = 'Invalid notification recipient.', updated_at = $1
              WHERE id = $2
            `,
            [now().toISOString(), event.id],
          );
          continue;
        }

        let locale: MessageLocale | undefined;
        if (!userId && isTenantInvitation) {
          const users = await client.execute<{
            id: string;
            locale: string | null;
          }>(
            `
              SELECT id, locale
              FROM auth_users
              WHERE normalized_email = LOWER($1)
                AND deleted_at IS NULL
              LIMIT 1
            `,
            [email.trim()],
          );
          userId = users[0]?.id;
          locale = users[0]?.locale ?? undefined;
        } else if (userId) {
          const users = await client.execute<{ locale: string | null }>(
            "SELECT locale FROM auth_users WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
            [userId],
          );
          locale = users[0]?.locale ?? undefined;
        }

        const tenantId =
          event.tenant_id ??
          (typeof payload.organizationId === "string"
            ? payload.organizationId
            : undefined);
        if (!locale && isTenantInvitation && tenantId) {
          const organizations = await client.execute<{
            default_locale: string;
          }>("SELECT default_locale FROM organizations WHERE id = $1 LIMIT 1", [
            tenantId,
          ]);
          locale = organizations[0]?.default_locale;
        }

        await queueEmail({
          eventType: isTenantInvitation
            ? "tenant.invitation.notification"
            : `auth.${kind}`,
          idempotencyKey: `outbox:${event.id}`,
          locale: locale ?? "en",
          payload: { ...payload, kind },
          recipient: { email },
          templateKey: "auth.notification",
          tenantId,
          userId,
        });
        const timestamp = now().toISOString();
        await client.execute(
          `
            UPDATE outbox_events
            SET status = 'dispatched', attempts = attempts + 1,
                dispatched_at = $1, updated_at = $1, last_error = NULL
            WHERE id = $2
          `,
          [timestamp, event.id],
        );
        dispatched += 1;
      } catch (error) {
        const timestamp = now();
        const message = error instanceof Error ? error.message : String(error);
        const retryDelaySeconds = Math.min(30 * 2 ** event.attempts, 3_600);

        await client.execute(
          `
            UPDATE outbox_events
            SET status = CASE
                  WHEN attempts + 1 >= $1 THEN 'failed'
                  ELSE 'queued'
                END,
                attempts = attempts + 1,
                available_at = $2,
                last_error = $3,
                locked_at = NULL,
                locked_by = NULL,
                updated_at = $4
            WHERE id = $5
          `,
          [
            outboxMaxAttempts,
            new Date(
              timestamp.getTime() + retryDelaySeconds * 1_000,
            ).toISOString(),
            message,
            timestamp.toISOString(),
            event.id,
          ],
        );
      }
    }

    return dispatched;
  }

  async function sendSms(input: {
    body: string;
    eventType: string;
    from?: string;
    tenantId?: string;
    to: string;
    userId: string;
  }) {
    if (!options.smsProvider) {
      throw new Error("An SMS provider is not configured.");
    }

    const preference = await getPreference(input);
    if (preference?.smsEnabled !== true) {
      return undefined;
    }

    return options.smsProvider.send({
      body: input.body,
      from: input.from,
      tags: { event: input.eventType },
      to: input.to,
    });
  }

  async function sendPush(input: {
    body: string;
    data?: Record<string, string>;
    eventType: string;
    tenantId?: string;
    title: string;
    tokens: string[];
    userId: string;
  }) {
    if (!options.pushProvider) {
      throw new Error("A push provider is not configured.");
    }

    const preference = await getPreference(input);
    if (preference?.pushEnabled === false) {
      return undefined;
    }

    return options.pushProvider.send({
      body: input.body,
      data: input.data,
      title: input.title,
      tokens: input.tokens,
    });
  }

  return {
    createInAppNotification,
    dispatchOutbox,
    getPreference,
    listDeliveries,
    listInAppNotifications,
    listPreferences,
    processEmailDelivery,
    queueEmail,
    sendPush,
    sendSms,
    setPreference,
    updateInAppNotification,
  };
}

export function createMessagingJobHandlers(
  service: ReturnType<typeof createMessagingService>,
) {
  return {
    [messagingJobTypes.dispatchOutbox]: async () => {
      await service.dispatchOutbox();
    },
    [messagingJobTypes.sendEmail]: async (job: {
      payload: Record<string, unknown>;
    }) => {
      const deliveryId = job.payload.deliveryId;

      if (typeof deliveryId !== "string" || !deliveryId) {
        throw new Error("Messaging email job requires a deliveryId.");
      }

      await service.processEmailDelivery(deliveryId);
    },
  };
}
