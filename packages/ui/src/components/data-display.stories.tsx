import { Badge } from "./badge";
import { MetricLineChart } from "./chart";
import { DataTable } from "./data-table";

const meta = {
  title: "UI/Data Display",
};

export default meta;

const rows = [
  { module: "Core shell", owner: "Core", status: "ready" },
  { module: "Localization", owner: "Localization", status: "ready" },
  { module: "Billing", owner: "Billing", status: "queued" },
];

export function DataDisplay() {
  return (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] gap-4">
      <DataTable
        columns={[
          { key: "module", header: "Module", cell: (row) => row.module },
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
        data={rows}
      />
      <MetricLineChart
        data={[
          { label: "Mon", value: 12 },
          { label: "Tue", value: 18 },
          { label: "Wed", value: 16 },
          { label: "Thu", value: 24 },
        ]}
        description="Accessible chart wrapper example."
        title="Activity"
      />
    </div>
  );
}
