import { formatNumber } from "@nextjs-saas/localization";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { requireAdminSession } from "../../../../../lib/admin-auth";
import { assertLocale } from "../../../../../lib/locale";
import { formatLocaleDateTime } from "../../../../../lib/locale-formatters";
import { getObservabilityService } from "../../../../../lib/observability";

export default async function ObservabilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  await requireAdminSession();
  const observability = getObservabilityService();
  const [t, health, summary] = await Promise.all([
    getTranslations({ locale, namespace: "AdminObservability" }),
    observability.runHealthChecks(),
    observability.getOperationalSummary(),
  ]);
  const logTotal = Object.values(summary.logCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const auditTotal = Object.values(summary.auditCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const auditSourceLabels: Record<string, string> = {
    api: t("auditSources.api"),
    auth: t("auditSources.auth"),
    billing: t("auditSources.billing"),
    messaging: t("auditSources.messaging"),
    storage: t("auditSources.storage"),
    tenant: t("auditSources.tenant"),
  };
  const logLevelLabels = {
    debug: t("logLevels.debug"),
    error: t("logLevels.error"),
    fatal: t("logLevels.fatal"),
    info: t("logLevels.info"),
    warn: t("logLevels.warn"),
  };
  const uptimeStatusLabels = {
    down: t("uptimeStatus.down"),
    up: t("uptimeStatus.up"),
  };
  const uptimeMonitorLabels: Record<string, string> = {
    "web-application-liveness": t("uptimeMonitors.webApplicationLiveness"),
  };
  const formatDuration = (durationMs: number) =>
    formatNumber(locale, durationMs, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
      style: "unit",
      unit: "millisecond",
      unitDisplay: "short",
    });
  const summaryCards = [
    {
      badge: t(`healthStatus.${health.status}`),
      title: t("health"),
      value: t(`healthStatus.${health.status}`),
    },
    {
      badge: t("summaryBadges.logs"),
      title: t("logs"),
      value: formatNumber(locale, logTotal),
    },
    {
      badge: t("summaryBadges.audits"),
      title: t("audits"),
      value: formatNumber(locale, auditTotal),
    },
    {
      badge: t("summaryBadges.monitors"),
      title: t("monitors"),
      value: formatNumber(locale, summary.uptimeMonitors.length),
    },
  ];

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              {card.title}
              <Badge variant="outline">{card.badge}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {card.value}
          </CardContent>
        </Card>
      ))}

      <Card className="min-w-0 md:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle>{t("healthChecks")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { cell: (row) => row.name, header: t("table.name"), key: "name" },
              {
                cell: (row) => t(`healthStatus.${row.status}`),
                header: t("table.status"),
                key: "status",
              },
              {
                cell: (row) => formatDuration(row.durationMs),
                header: t("table.duration"),
                key: "duration",
              },
            ]}
            data={health.checks}
            emptyLabel={t("emptyChecks")}
          />
        </CardContent>
      </Card>

      <Card className="min-w-0 md:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle>{t("recentLogs")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (row) => formatLocaleDateTime(locale, row.timestamp),
                header: t("table.time"),
                key: "time",
              },
              {
                cell: (row) => logLevelLabels[row.level],
                header: t("table.level"),
                key: "level",
              },
              {
                cell: (row) => row.service,
                header: t("table.service"),
                key: "service",
              },
              {
                cell: (row) => row.message,
                header: t("table.message"),
                key: "message",
              },
              {
                cell: (row) => row.requestId ?? row.traceId ?? row.jobId ?? "—",
                header: t("table.correlation"),
                key: "correlation",
              },
            ]}
            data={summary.recentLogs}
            emptyLabel={t("emptyLogs")}
          />
        </CardContent>
      </Card>

      <Card className="min-w-0 md:col-span-2">
        <CardHeader>
          <CardTitle>{t("uptime")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (row) => uptimeMonitorLabels[row.name] ?? row.name,
                header: t("table.name"),
                key: "name",
              },
              {
                cell: (row) =>
                  row.lastStatus
                    ? uptimeStatusLabels[row.lastStatus]
                    : t("pending"),
                header: t("table.status"),
                key: "status",
              },
              {
                cell: (row) =>
                  row.lastDurationMs === undefined
                    ? "—"
                    : formatDuration(row.lastDurationMs),
                header: t("table.duration"),
                key: "duration",
              },
            ]}
            data={summary.uptimeMonitors}
            emptyLabel={t("emptyMonitors")}
          />
        </CardContent>
      </Card>

      <Card className="min-w-0 md:col-span-2">
        <CardHeader>
          <CardTitle>{t("auditTrail")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (row) => auditSourceLabels[row.source] ?? row.source,
                header: t("table.source"),
                key: "source",
              },
              {
                cell: (row) => formatNumber(locale, row.count),
                header: t("table.events"),
                key: "events",
              },
            ]}
            data={Object.entries(summary.auditCounts).map(
              ([source, count]) => ({ count, source }),
            )}
            emptyLabel={t("emptyAudits")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
