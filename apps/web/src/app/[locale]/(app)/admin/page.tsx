import { formatNumber, localeLabels } from "@nextjs-saas/localization";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { requireAdminSession } from "../../../../lib/admin-auth";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";
import { formatLocaleDateTime } from "../../../../lib/locale-formatters";
import { getMessagingService } from "../../../../lib/messaging";
import { getTenantService } from "../../../../lib/tenant";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const [t, session, repository] = await Promise.all([
    getTranslations({ locale, namespace: "AdminOverview" }),
    requireAdminSession(),
    getContentRepository(),
  ]);
  const pages = repository.listAllPages();
  const submissions = repository.listContactSubmissions();
  const localization = repository.getLocalizationSettings();
  const [tenantSummary, deliveries] = await Promise.all([
    getTenantService().getSuperAdminSummary({
      actorGlobalRole: session.user.role,
      actorId: session.user.id,
    }),
    getMessagingService().listDeliveries({ limit: 20 }),
  ]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        [t("managedPages"), String(pages.length), t("managedPagesDescription")],
        [
          t("locales"),
          formatNumber(locale, localization.enabledLocales.length),
          t("localeDescription", {
            defaultLocale: localeLabels[localization.defaultLocale],
          }),
        ],
        [
          t("contactMessages"),
          String(submissions.length),
          t("contactDescription"),
        ],
        [
          t("organizations"),
          String(tenantSummary.organizations.length),
          t("organizationsDescription"),
        ],
        [
          t("tenantMembers"),
          String(tenantSummary.members.length),
          t("tenantMembersDescription"),
        ],
        [
          t("impersonations"),
          String(tenantSummary.activeImpersonations.length),
          t("impersonationsDescription"),
        ],
        [
          t("messageDeliveries"),
          String(deliveries.length),
          t("messageDeliveriesDescription"),
        ],
      ].map(([title, value, description]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              {title}
              <Badge variant="outline">{t("adminBadge")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{value}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>{t("deliveryLogTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (delivery) => delivery.recipient,
                header: t("deliveryTable.recipient"),
                key: "recipient",
              },
              {
                cell: (delivery) => delivery.eventType,
                header: t("deliveryTable.event"),
                key: "event",
              },
              {
                cell: (delivery) => delivery.provider,
                header: t("deliveryTable.provider"),
                key: "provider",
              },
              {
                cell: (delivery) => delivery.status,
                header: t("deliveryTable.status"),
                key: "status",
              },
              {
                cell: (delivery) =>
                  formatLocaleDateTime(locale, delivery.createdAt),
                header: t("deliveryTable.created"),
                key: "created",
              },
            ]}
            data={deliveries}
            emptyLabel={t("emptyDeliveries")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
