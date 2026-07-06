import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { assertLocale } from "../../../../lib/locale";
import {
  formatLocaleDateTime,
  formatLocaleGigabytes,
  formatLocaleNumber,
} from "../../../../lib/locale-formatters";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../lib/tenant";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = assertLocale(locale);
  const [t, context] = await Promise.all([
    getTranslations("DashboardPage"),
    getActiveTenantContext("dashboard.read"),
  ]);
  const summary = await getTenantService().getDashboardSummary({
    organizationId: context.organization.id,
    userId: context.effectiveUser.id,
  });
  const formatNumber = (value: number) =>
    formatLocaleNumber(resolvedLocale, value);
  const formatBytes = (value: number) =>
    formatLocaleGigabytes(resolvedLocale, value);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <Badge className="w-fit" variant="outline">
          {summary.membership.role}
        </Badge>
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            {summary.organization.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            {summary.organization.description ?? t("organizationFallback")}
          </p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [t("cards.members.label"), formatNumber(summary.memberCount)],
          [t("cards.invitations.label"), formatNumber(summary.invitationCount)],
          [t("cards.apiKeys.label"), formatNumber(summary.activeApiKeyCount)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <DataTable
        columns={[
          { key: "key", header: t("flags.key"), cell: (row) => row.key },
          {
            key: "enabled",
            header: t("flags.status"),
            cell: (row) => (
              <Badge variant={row.enabled ? "success" : "warning"}>
                {row.enabled ? t("enabled") : t("disabled")}
              </Badge>
            ),
          },
        ]}
        data={summary.featureFlags}
        emptyLabel={t("flags.empty")}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("quotas.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t("quotas.storage")}
              </span>
              <span className="font-medium">
                {summary.quota
                  ? `${formatBytes(summary.quota.storageBytesUsed)} / ${formatBytes(summary.quota.storageBytesLimit)}`
                  : t("notConfigured")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("quotas.ai")}</span>
              <span className="font-medium">
                {summary.quota
                  ? `${formatNumber(summary.quota.aiTokenUsed)} / ${formatNumber(summary.quota.aiTokenLimit)}`
                  : t("notConfigured")}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("audit.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (event) => event.eventType,
                  header: t("audit.event"),
                  key: "event",
                },
                {
                  cell: (event) =>
                    formatLocaleDateTime(resolvedLocale, event.createdAt),
                  header: t("audit.created"),
                  key: "created",
                },
              ]}
              data={summary.auditEvents}
              emptyLabel={t("audit.empty")}
            />
          </CardContent>
        </Card>
      </div>
      <DataTable
        columns={[
          { key: "key", header: t("limits.key"), cell: (row) => row.key },
          {
            key: "used",
            header: t("limits.used"),
            cell: (row) => formatNumber(row.usedValue),
          },
          {
            key: "limit",
            header: t("limits.limit"),
            cell: (row) => formatNumber(row.limitValue),
          },
        ]}
        data={summary.usageLimits}
        emptyLabel={t("limits.empty")}
      />
    </div>
  );
}
