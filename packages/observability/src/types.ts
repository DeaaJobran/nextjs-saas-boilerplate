export type LogLevel = "debug" | "error" | "fatal" | "info" | "warn";

export type LogCategory =
  "admin" | "api" | "application" | "audit" | "job" | "request" | "security";

export type LogError = {
  message: string;
  name: string;
  stack?: string;
};

export type StructuredLogRecord = {
  actorId?: string;
  attributes: Record<string, unknown>;
  category: LogCategory;
  error?: LogError;
  jobId?: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  service: string;
  spanId?: string;
  tenantId?: string;
  timestamp: string;
  traceId?: string;
};

export type LogTransport = {
  id: string;
  write(record: StructuredLogRecord): Promise<void> | void;
};

export type LoggerContext = Partial<
  Pick<
    StructuredLogRecord,
    "actorId" | "category" | "jobId" | "requestId" | "tenantId"
  >
> & {
  attributes?: Record<string, unknown>;
};

export type HealthCheckStatus = "degraded" | "healthy" | "unhealthy";

export type HealthCheckResult = {
  durationMs: number;
  message?: string;
  name: string;
  status: HealthCheckStatus;
};

export type HealthReport = {
  checks: HealthCheckResult[];
  service: string;
  status: HealthCheckStatus;
  timestamp: string;
};

export type UptimeMonitor = {
  active: boolean;
  createdAt: string;
  expectedStatus: number;
  id: string;
  intervalSeconds: number;
  lastCheckedAt?: string;
  lastDurationMs?: number;
  lastError?: string;
  lastStatus?: "down" | "up";
  method: "GET" | "HEAD";
  name: string;
  nextCheckAt: string;
  timeoutMs: number;
  updatedAt: string;
  url: string;
};

export type OperationalSummary = {
  auditCounts: Record<string, number>;
  logCounts: Record<LogLevel, number>;
  recentLogs: StructuredLogRecord[];
  recentMetrics: Array<{
    attributes: Record<string, unknown>;
    name: string;
    recordedAt: string;
    unit?: string;
    value: number;
  }>;
  recentSpans: Array<{
    durationMs: number;
    name: string;
    service: string;
    status: string;
    traceId: string;
  }>;
  uptimeMonitors: UptimeMonitor[];
};
