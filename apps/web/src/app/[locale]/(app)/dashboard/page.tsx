import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  MetricLineChart,
} from "@nextjs-saas/ui";

const metrics = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 16 },
  { label: "Thu", value: 24 },
  { label: "Fri", value: 28 },
];

const modules = [
  { name: "Application shell", owner: "Core", status: "ready" },
  { name: "Localization foundation", owner: "Localization", status: "ready" },
  { name: "Billing provider boundary", owner: "Billing", status: "queued" },
];

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Layouts", "5 shell contracts"],
          ["Locales", "English and Arabic"],
          ["UI primitives", "Forms, tables, charts"],
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
        description="Demo activity rendered through the reusable chart primitive."
        title="Demo activity"
      />
      <DataTable
        columns={[
          { key: "name", header: "Module", cell: (row) => row.name },
          { key: "owner", header: "Owner", cell: (row) => row.owner },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <Badge variant={row.status === "ready" ? "success" : "warning"}>
                {row.status}
              </Badge>
            ),
          },
        ]}
        data={modules}
      />
    </div>
  );
}
