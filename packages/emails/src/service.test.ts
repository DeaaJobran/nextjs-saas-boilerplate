import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMessagingJobHandlers, createMessagingService } from "./service";
import type { EmailProvider, EmailSendInput } from "./types";

const fixedNow = new Date("2026-08-01T12:00:00.000Z");
const databaseTestTimeoutMs = 60_000;
let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-emails-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();

  const runtime = await getDatabaseRuntime();
  await runMigrations(runtime);
  await runtime.execute(
    `
      INSERT INTO auth_users (
        id, email, normalized_email, display_name, role,
        locale, created_at, updated_at
      )
      VALUES ('user_1', 'user@example.test', 'user@example.test', 'Ada', 'user', 'ar', $1, $1)
    `,
    [fixedNow.toISOString()],
  );
  await runtime.execute(
    `
      INSERT INTO organizations (
        id, slug, name, default_locale, status,
        created_by, updated_by, created_at, updated_at
      )
      VALUES ('tenant_1', 'tenant-one', 'Tenant One', 'ar', 'active', 'user_1', 'user_1', $1, $1)
    `,
    [fixedNow.toISOString()],
  );
});

afterEach(async () => {
  const runtime = await getDatabaseRuntime();
  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

function serviceWithProvider(provider: EmailProvider) {
  return createMessagingService({
    brand: { accentColor: "#2563eb", name: "Tenant Brand" },
    emailProvider: provider,
    from: { email: "no-reply@example.test", name: "Tenant Brand" },
    now: () => fixedNow,
  });
}

describe("messaging service", () => {
  it(
    "queues idempotent localized email, processes delivery, and records audit logs",
    async () => {
      const sent: EmailSendInput[] = [];
      const provider: EmailProvider = {
        id: "test",
        async send(input) {
          sent.push(input);
          return { accepted: true, messageId: "provider-1", provider: "test" };
        },
      };
      const service = serviceWithProvider(provider);
      const queued = await service.queueEmail({
        eventType: "auth.password_reset",
        idempotencyKey: "reset-1",
        locale: "ar",
        payload: {
          kind: "password_reset",
          link: "https://example.test/reset/token",
        },
        recipient: { email: "user@example.test", name: "Ada" },
        templateKey: "auth.notification",
        tenantId: "tenant_1",
        userId: "user_1",
      });
      const duplicate = await service.queueEmail({
        eventType: "auth.password_reset",
        idempotencyKey: "reset-1",
        locale: "ar",
        payload: {},
        recipient: { email: "user@example.test" },
        templateKey: "auth.notification",
        tenantId: "tenant_1",
        userId: "user_1",
      });

      const runtime = await getDatabaseRuntime();
      await runtime.execute(
        `
          INSERT INTO organizations (
            id, slug, name, default_locale, status,
            created_by, updated_by, created_at, updated_at
          )
          VALUES ('tenant_2', 'tenant-two', 'Tenant Two', 'en', 'active', 'user_1', 'user_1', $1, $1)
        `,
        [fixedNow.toISOString()],
      );
      const otherTenant = await service.queueEmail({
        eventType: "auth.password_reset",
        idempotencyKey: "reset-1",
        locale: "en",
        payload: {},
        recipient: { email: "other@example.test" },
        templateKey: "auth.notification",
        tenantId: "tenant_2",
        userId: "user_1",
      });

      expect(duplicate.id).toBe(queued.id);
      expect(otherTenant.id).not.toBe(queued.id);

      const handlers = createMessagingJobHandlers(service);
      await handlers["messaging.email.send"]({
        payload: { deliveryId: queued.id },
      });

      const deliveries = await service.listDeliveries({
        tenantId: "tenant_1",
      });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        attempts: 1,
        providerMessageId: "provider-1",
        status: "sent",
      });
      expect(sent[0]?.html).toContain('dir="rtl"');
      expect(sent[0]?.subject).toBe("إعادة تعيين كلمة المرور");

      const audit = await runtime.execute<{ event_type: string }>(
        "SELECT event_type FROM messaging_audit_events ORDER BY created_at",
      );
      expect(audit.map((row) => row.event_type)).toContain(
        "messaging.delivery.sent",
      );
    },
    databaseTestTimeoutMs,
  );

  it(
    "claims a delivery once and never resends after an audit failure",
    async () => {
      const runtime = await getDatabaseRuntime();
      let failAudit = false;
      const client: Queryable = {
        async execute<T = Record<string, unknown>>(
          query: string,
          params: unknown[] = [],
        ) {
          if (
            failAudit &&
            query.includes("INSERT INTO messaging_audit_events")
          ) {
            throw new Error("Audit unavailable");
          }

          return runtime.execute<T>(query, params);
        },
      };
      let releaseSend!: () => void;
      const sendReleased = new Promise<void>((resolve) => {
        releaseSend = resolve;
      });
      const send = vi.fn(async () => {
        await sendReleased;
        return {
          accepted: true,
          messageId: "provider-atomic",
          provider: "test",
        };
      });
      const service = createMessagingService({
        brand: { name: "Tenant Brand" },
        client,
        emailProvider: { id: "test", send },
        from: { email: "no-reply@example.test" },
        now: () => fixedNow,
      });
      const queued = await service.queueEmail({
        eventType: "account.welcome",
        payload: { body: "Welcome", subject: "Welcome", title: "Welcome" },
        recipient: { email: "user@example.test" },
        templateKey: "transactional",
        tenantId: "tenant_1",
        userId: "user_1",
      });

      const firstAttempt = service.processEmailDelivery(queued.id);
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      await expect(service.processEmailDelivery(queued.id)).rejects.toThrow(
        "already being processed",
      );
      failAudit = true;
      releaseSend();
      await expect(firstAttempt).rejects.toThrow("Audit unavailable");
      failAudit = false;
      await expect(
        service.processEmailDelivery(queued.id),
      ).resolves.toMatchObject({
        status: "sent",
      });
      expect(send).toHaveBeenCalledOnce();
      const sentAudits = await runtime.execute<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM messaging_audit_events
          WHERE delivery_id = $1
            AND event_type = 'messaging.delivery.sent'
        `,
        [queued.id],
      );
      expect(sentAudits[0]?.count).toBe("1");
    },
    databaseTestTimeoutMs,
  );

  it(
    "reclaims a delivery when the background-job lock expires",
    async () => {
      let currentTime = fixedNow;
      const send = vi.fn().mockResolvedValue({
        accepted: true,
        messageId: "provider-reclaimed",
        provider: "test",
      });
      const service = createMessagingService({
        brand: { name: "Tenant Brand" },
        emailProvider: { id: "test", send },
        from: { email: "no-reply@example.test" },
        now: () => currentTime,
      });
      const queued = await service.queueEmail({
        eventType: "account.welcome",
        payload: { body: "Welcome", subject: "Welcome", title: "Welcome" },
        recipient: { email: "user@example.test" },
        templateKey: "transactional",
        tenantId: "tenant_1",
        userId: "user_1",
      });
      const runtime = await getDatabaseRuntime();
      await runtime.execute(
        `
          UPDATE message_deliveries
          SET status = 'sending', attempts = 1, updated_at = $1
          WHERE id = $2
        `,
        [currentTime.toISOString(), queued.id],
      );

      currentTime = new Date(currentTime.getTime() + 5 * 60 * 1_000);

      await expect(
        service.processEmailDelivery(queued.id),
      ).resolves.toMatchObject({
        attempts: 2,
        status: "sent",
      });
      expect(send).toHaveBeenCalledOnce();
    },
    databaseTestTimeoutMs,
  );

  it(
    "atomically creates or updates a scoped notification preference",
    async () => {
      const provider = {
        id: "test",
        send: vi.fn(),
      } satisfies EmailProvider;
      const service = serviceWithProvider(provider);

      await Promise.all([
        service.setPreference({
          emailEnabled: true,
          eventType: "account.updated",
          inAppEnabled: true,
          pushEnabled: false,
          smsEnabled: false,
          tenantId: "tenant_1",
          userId: "user_1",
        }),
        service.setPreference({
          emailEnabled: false,
          eventType: "account.updated",
          inAppEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
          tenantId: "tenant_1",
          userId: "user_1",
        }),
      ]);

      const preferences = await service.listPreferences({
        tenantId: "tenant_1",
        userId: "user_1",
      });
      expect(preferences).toHaveLength(1);
      expect(preferences[0]?.eventType).toBe("account.updated");
    },
    databaseTestTimeoutMs,
  );

  it(
    "respects channel preferences and manages in-app notification state",
    async () => {
      const provider = {
        id: "test",
        send: vi.fn().mockResolvedValue({
          accepted: true,
          messageId: "provider-1",
          provider: "test",
        }),
      } satisfies EmailProvider;
      const service = serviceWithProvider(provider);

      await service.setPreference({
        actorId: "user_1",
        emailEnabled: false,
        eventType: "product.update",
        inAppEnabled: false,
        locale: "ar",
        pushEnabled: true,
        smsEnabled: false,
        tenantId: "tenant_1",
        userId: "user_1",
      });

      const delivery = await service.queueEmail({
        eventType: "product.update",
        payload: { body: "Update", subject: "Update", title: "Update" },
        recipient: { email: "user@example.test" },
        templateKey: "transactional",
        tenantId: "tenant_1",
        userId: "user_1",
      });
      const suppressedNotification = await service.createInAppNotification({
        body: "Update",
        eventType: "product.update",
        tenantId: "tenant_1",
        title: "Update",
        userId: "user_1",
      });

      expect(delivery.status).toBe("suppressed");
      expect(suppressedNotification).toBeUndefined();
      expect(provider.send).not.toHaveBeenCalled();

      const notification = await service.createInAppNotification({
        actionUrl: "/dashboard",
        body: "Welcome",
        eventType: "account.welcome",
        tenantId: "tenant_1",
        title: "Welcome",
        userId: "user_1",
      });
      const read = await service.updateInAppNotification({
        action: "read",
        notificationId: notification!.id,
        tenantId: "tenant_1",
        userId: "user_1",
      });

      expect(read?.readAt).toBe(fixedNow.toISOString());
      await expect(
        service.listInAppNotifications({
          tenantId: "tenant_1",
          userId: "user_1",
        }),
      ).resolves.toHaveLength(1);

      const smsSend = vi.fn().mockResolvedValue({
        messageId: "sms-1",
        provider: "sms-test",
      });
      const pushSend = vi.fn().mockResolvedValue({
        messageId: "push-1",
        provider: "push-test",
      });
      const channelService = createMessagingService({
        brand: { name: "Tenant Brand" },
        emailProvider: provider,
        from: { email: "no-reply@example.test" },
        now: () => fixedNow,
        pushProvider: { id: "push-test", send: pushSend },
        smsProvider: { id: "sms-test", send: smsSend },
      });

      await channelService.setPreference({
        emailEnabled: true,
        eventType: "*",
        inAppEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        tenantId: "tenant_1",
        userId: "user_1",
      });
      await channelService.sendSms({
        body: "Your code is 1234",
        eventType: "account.welcome",
        tenantId: "tenant_1",
        to: "+15555550123",
        userId: "user_1",
      });
      await channelService.sendPush({
        body: "Welcome",
        eventType: "account.welcome",
        tenantId: "tenant_1",
        title: "Welcome",
        tokens: ["device-token"],
        userId: "user_1",
      });

      expect(smsSend).toHaveBeenCalledOnce();
      expect(pushSend).toHaveBeenCalledOnce();
    },
    databaseTestTimeoutMs,
  );

  it(
    "dispatches the auth outbox and retains failure details for worker retries",
    async () => {
      let shouldFail = true;
      const provider: EmailProvider = {
        id: "flaky",
        async send() {
          if (shouldFail) {
            throw new Error("SMTP unavailable");
          }

          return { accepted: true, messageId: "provider-2", provider: "flaky" };
        },
      };
      const service = serviceWithProvider(provider);
      const runtime = await getDatabaseRuntime();
      await runtime.execute(
        `
          INSERT INTO outbox_events (
            id, event_type, payload, status, attempts,
            available_at, created_at, updated_at
          )
          VALUES ('outbox_1', 'auth.notification', $1::jsonb, 'queued', 0, $2, $2, $2)
        `,
        [
          JSON.stringify({
            email: "user@example.test",
            kind: "magic_link",
            link: "https://example.test/sign-in/token",
            userId: "user_1",
          }),
          fixedNow.toISOString(),
        ],
      );
      await runtime.execute(
        `
          INSERT INTO outbox_events (
            id, event_type, payload, status, attempts,
            available_at, created_at, updated_at
          )
          VALUES ('outbox_poison', 'auth.notification', $1::jsonb, 'queued', 0, $2, $2, $2)
        `,
        [
          JSON.stringify({
            email: "poison@example.test",
            kind: "magic_link",
            userId: "missing_user",
          }),
          new Date(fixedNow.getTime() - 1_000).toISOString(),
        ],
      );

      await expect(service.dispatchAuthOutbox()).resolves.toBe(1);
      const [delivery] = await service.listDeliveries({ userId: "user_1" });

      await expect(service.processEmailDelivery(delivery!.id)).rejects.toThrow(
        "SMTP unavailable",
      );
      shouldFail = false;
      await expect(
        service.processEmailDelivery(delivery!.id),
      ).resolves.toMatchObject({ attempts: 2, status: "sent" });

      const [outbox] = await runtime.execute<{
        attempts: number;
        status: string;
      }>("SELECT status, attempts FROM outbox_events WHERE id = 'outbox_1'");
      expect(outbox).toEqual({ attempts: 1, status: "dispatched" });
      const [poison] = await runtime.execute<{
        attempts: number;
        last_error: string | null;
        status: string;
      }>(
        "SELECT status, attempts, last_error FROM outbox_events WHERE id = 'outbox_poison'",
      );
      expect(poison).toMatchObject({
        attempts: 1,
        status: "queued",
      });
      expect(poison?.last_error).toBeTruthy();
    },
    databaseTestTimeoutMs,
  );
});
