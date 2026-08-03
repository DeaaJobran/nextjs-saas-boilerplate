import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

export type ChartDatum = {
  label: string;
  value: number;
};

type MetricChartProps = {
  categoryLabel: string;
  data: ChartDatum[];
  description: string;
  empty?: React.ReactNode;
  emptyLabel: string;
  formatValue?: (value: number) => string;
  title: string;
  valueLabel: string;
};

function ChartDataTable({
  categoryLabel,
  data,
  formatValue,
  title,
  valueLabel,
}: Pick<
  MetricChartProps,
  "categoryLabel" | "data" | "formatValue" | "title" | "valueLabel"
>) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{categoryLabel}</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.label}>
            <th scope="row">{item.label}</th>
            <td>{formatValue ? formatValue(item.value) : item.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyChart({
  description,
  empty,
  emptyLabel,
  title,
}: Pick<MetricChartProps, "description" | "empty" | "emptyLabel" | "title">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ?? (
          <p className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
            {emptyLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricLineChart({
  categoryLabel,
  data,
  description,
  empty,
  emptyLabel,
  formatValue,
  title,
  valueLabel,
}: MetricChartProps) {
  if (data.length === 0) {
    return (
      <EmptyChart
        description={description}
        empty={empty}
        emptyLabel={emptyLabel}
        title={title}
      />
    );
  }

  const width = 640;
  const height = 240;
  const padding = 32;
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = data.map((item, index) => {
    const x =
      padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y =
      height - padding - ((item.value - min) / range) * (height - padding * 2);

    return { ...item, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          aria-label={`${title}: ${description}`}
          className="h-64 w-full overflow-visible"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {[0, 1, 2, 3].map((line) => {
            const y = padding + line * ((height - padding * 2) / 3);

            return (
              <line
                className="stroke-border"
                key={line}
                strokeDasharray="4 4"
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
              />
            );
          })}
          <path
            className="stroke-primary fill-none"
            d={path}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {points.map((point) => (
            <g key={point.label}>
              <circle
                className="fill-background stroke-primary"
                cx={point.x}
                cy={point.y}
                r="5"
                strokeWidth="3"
              />
              <text
                className="fill-muted-foreground text-[12px]"
                textAnchor="middle"
                x={point.x}
                y={height - 8}
              >
                {point.label}
              </text>
              <title>{`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}</title>
            </g>
          ))}
        </svg>
        <ChartDataTable
          categoryLabel={categoryLabel}
          data={data}
          formatValue={formatValue}
          title={title}
          valueLabel={valueLabel}
        />
      </CardContent>
    </Card>
  );
}

export function MetricBarChart({
  categoryLabel,
  data,
  description,
  empty,
  emptyLabel,
  formatValue,
  title,
  valueLabel,
}: MetricChartProps) {
  if (data.length === 0) {
    return (
      <EmptyChart
        description={description}
        empty={empty}
        emptyLabel={emptyLabel}
        title={title}
      />
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          aria-label={`${title}: ${description}`}
          className="grid gap-4"
          role="img"
        >
          {data.map((item) => {
            const formattedValue = formatValue
              ? formatValue(item.value)
              : String(item.value);
            const percentage =
              item.value === 0 ? 0 : Math.max((item.value / max) * 100, 1);

            return (
              <div className="grid gap-2" key={item.label}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formattedValue}
                  </span>
                </div>
                <div className="bg-muted h-3 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    data-slot="metric-bar"
                    data-value={item.value}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <ChartDataTable
          categoryLabel={categoryLabel}
          data={data}
          formatValue={formatValue}
          title={title}
          valueLabel={valueLabel}
        />
      </CardContent>
    </Card>
  );
}
