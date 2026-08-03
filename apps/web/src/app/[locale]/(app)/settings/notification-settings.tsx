import type { Locale } from "@nextjs-saas/localization";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { formatLocaleDateTime } from "../../../../lib/locale-formatters";
import { getMessagingService } from "../../../../lib/messaging";
import {
  markNotificationReadAction,
  updateNotificationPreferencesAction,
} from "./actions";

type NotificationSettingsProps = {
  locale: Locale;
  tenantId: string;
  userId: string;
};

const notificationChannels = [
  { defaultEnabled: true, key: "email", name: "emailEnabled" },
  { defaultEnabled: true, key: "inApp", name: "inAppEnabled" },
  { defaultEnabled: true, key: "push", name: "pushEnabled" },
  { defaultEnabled: false, key: "sms", name: "smsEnabled" },
] as const;

export async function NotificationSettings({
  locale,
  tenantId,
  userId,
}: NotificationSettingsProps) {
  const t = await getTranslations("SettingsPage");
  const messaging = getMessagingService();
  const [preferences, notifications] = await Promise.all([
    messaging.listPreferences({ tenantId, userId }),
    messaging.listInAppNotifications({ tenantId, userId }),
  ]);
  const preference = preferences.find((item) => item.eventType === "*");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationsTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t("notificationsDescription")}
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          action={updateNotificationPreferencesAction}
          aria-label={t("notificationsTitle")}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input name="locale" type="hidden" value={locale} />
          {notificationChannels.map(({ defaultEnabled, key, name }) => (
            <label
              className="bg-muted/30 flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-sm"
              key={name}
            >
              <input
                defaultChecked={preference?.[name] ?? defaultEnabled}
                name={name}
                type="checkbox"
              />
              {t(`notificationChannels.${key}`)}
            </label>
          ))}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">{t("saveNotificationPreferences")}</Button>
          </div>
        </form>
        <DataTable
          columns={[
            {
              cell: (notification) => notification.title,
              header: t("notificationTable.title"),
              key: "title",
            },
            {
              cell: (notification) => notification.eventType,
              header: t("notificationTable.event"),
              key: "event",
            },
            {
              cell: (notification) =>
                formatLocaleDateTime(locale, notification.createdAt),
              header: t("notificationTable.created"),
              key: "created",
            },
            {
              cell: (notification) =>
                notification.readAt ? (
                  <Badge variant="outline">{t("read")}</Badge>
                ) : (
                  <form action={markNotificationReadAction}>
                    <input
                      name="notificationId"
                      type="hidden"
                      value={notification.id}
                    />
                    <input name="locale" type="hidden" value={locale} />
                    <Button size="sm" type="submit" variant="outline">
                      {t("markRead")}
                    </Button>
                  </form>
                ),
              header: t("notificationTable.status"),
              key: "status",
            },
          ]}
          data={notifications}
          empty={
            <EmptyState
              description={t("emptyNotificationsDescription")}
              headingLevel="h4"
              title={t("emptyNotifications")}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
