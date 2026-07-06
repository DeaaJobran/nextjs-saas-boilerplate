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

export function MetricLineChart({
  data,
  description,
  title,
}: {
  data: ChartDatum[];
  description: string;
  title: string;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          No data available
        </CardContent>
      </Card>
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
            </g>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
