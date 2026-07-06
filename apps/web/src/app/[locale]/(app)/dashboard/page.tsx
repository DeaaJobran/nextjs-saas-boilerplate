import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  MetricLineChart,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

type ModuleStatus = "queued" | "ready";

export default async function DashboardPage() {
  const t = await getTranslations("DashboardPage");
  const metrics = [
    { label: t("days.mon"), value: 12 },
    { label: t("days.tue"), value: 18 },
    { label: t("days.wed"), value: 16 },
    { label: t("days.thu"), value: 24 },
    { label: t("days.fri"), value: 28 },
  ];
  const modules: {
    name: string;
    owner: string;
    status: ModuleStatus;
  }[] = [
    {
      name: t("modules.applicationShell"),
      owner: t("modules.core"),
      status: "ready",
    },
    {
      name: t("modules.localizationFoundation"),
      owner: t("modules.localization"),
      status: "ready",
    },
    {
      name: t("modules.billingBoundary"),
      owner: t("modules.billing"),
      status: "queued",
    },
  ];

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [t("cards.layouts.label"), t("cards.layouts.value")],
          [t("cards.locales.label"), t("cards.locales.value")],
          [t("cards.uiPrimitives.label"), t("cards.uiPrimitives.value")],
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
      <MetricLineChart
        data={metrics}
        description={t("chartDescription")}
        title={t("chartTitle")}
      />
      <DataTable
        columns={[
          { key: "name", header: t("table.module"), cell: (row) => row.name },
          { key: "owner", header: t("table.owner"), cell: (row) => row.owner },
          {
            key: "status",
            header: t("table.status"),
            cell: (row) => (
              <Badge variant={row.status === "ready" ? "success" : "warning"}>
                {t(`modules.${row.status}`)}
              </Badge>
            ),
          },
        ]}
        data={modules}
      />
    </div>
  );
}
