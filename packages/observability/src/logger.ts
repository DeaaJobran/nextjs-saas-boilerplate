import { context, trace } from "@opentelemetry/api";

import type {
  LogError,
  LoggerContext,
  LogLevel,
  LogTransport,
  StructuredLogRecord,
} from "./types";

const sensitiveKey =
  /authorization|cookie|credential|password|secret|token|api[-_]?key|session/i;

const bearerCredential = /\bBearer\s+[^\s,;]+/gi;
const labeledCredential =
  /\b(authorization|cookie|credential|password|secret|token|api[-_]?key|session)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi;

function isSchemeCharacter(value: string) {
  const code = value.charCodeAt(0);

  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    value === "+" ||
    value === "-" ||
    value === "."
  );
}

function isAsciiLetter(value: string) {
  const code = value.charCodeAt(0);

  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAuthorityBoundary(value: string) {
  return (
    value === "/" ||
    value === "?" ||
    value === "#" ||
    value === " " ||
    value === "\t" ||
    value === "\n" ||
    value === "\r"
  );
}

function redactConnectionCredentials(value: string) {
  let redacted = "";
  let searchStart = 0;

  while (searchStart < value.length) {
    const separator = value.indexOf("://", searchStart);

    if (separator === -1) {
      return redacted + value.slice(searchStart);
    }

    let schemeStart = separator;

    while (
      schemeStart > searchStart &&
      isSchemeCharacter(value[schemeStart - 1] ?? "")
    ) {
      schemeStart -= 1;
    }

    const authorityStart = separator + 3;

    if (!isAsciiLetter(value[schemeStart] ?? "")) {
      redacted += value.slice(searchStart, authorityStart);
      searchStart = authorityStart;
      continue;
    }

    let authorityEnd = authorityStart;

    while (
      authorityEnd < value.length &&
      !isAuthorityBoundary(value[authorityEnd] ?? "")
    ) {
      authorityEnd += 1;
    }

    const authority = value.slice(authorityStart, authorityEnd);
    const credentialEnd = authority.lastIndexOf("@");
    const credentialSeparator = authority.indexOf(":");

    redacted += value.slice(searchStart, authorityStart);

    if (credentialSeparator < 1 || credentialEnd <= credentialSeparator + 1) {
      redacted += authority;
    } else {
      redacted += `[REDACTED]:[REDACTED]@${authority.slice(credentialEnd + 1)}`;
    }

    searchStart = authorityEnd;
  }

  return redacted;
}

function redactLogText(value: string) {
  const redacted = redactConnectionCredentials(value)
    .replace(bearerCredential, "Bearer [REDACTED]")
    .replace(labeledCredential, "$1$2[REDACTED]");

  return redacted.length > 8_192 ? `${redacted.slice(0, 8_192)}…` : redacted;
}

export function redactLogError(error: unknown): LogError | undefined {
  if (!(error instanceof Error)) {
    return error === undefined
      ? undefined
      : { message: redactLogText(String(error)), name: "Error" };
  }

  return {
    message: redactLogText(error.message),
    name: redactLogText(error.name),
    stack: error.stack ? redactLogText(error.stack) : undefined,
  };
}

export function redactLogValue(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKey.test(key)) {
    return "[REDACTED]";
  }

  if (depth > 6) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => redactLogValue(item, key, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([childKey, childValue]) => [
          childKey,
          redactLogValue(childValue, childKey, depth + 1),
        ]),
    );
  }

  if (typeof value === "string" && value.length > 8_192) {
    return `${value.slice(0, 8_192)}…`;
  }

  return value;
}

export function createConsoleLogTransport(): LogTransport {
  return {
    id: "console",
    write(record) {
      const line = JSON.stringify(record);
      const target =
        record.level === "error" || record.level === "fatal"
          ? console.error
          : record.level === "warn"
            ? console.warn
            : console.info;

      target(line);
    },
  };
}

export function createLogger(options: {
  bindings?: LoggerContext;
  now?: () => Date;
  service: string;
  transports: LogTransport[];
}) {
  const now = options.now ?? (() => new Date());

  async function write(
    level: LogLevel,
    message: string,
    input: LoggerContext & { error?: unknown } = {},
  ) {
    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan?.spanContext();
    const attributes = redactLogValue({
      ...(options.bindings?.attributes ?? {}),
      ...(input.attributes ?? {}),
    }) as Record<string, unknown>;
    const record: StructuredLogRecord = {
      actorId: input.actorId ?? options.bindings?.actorId,
      attributes,
      category: input.category ?? options.bindings?.category ?? "application",
      error: redactLogError(input.error),
      jobId: input.jobId ?? options.bindings?.jobId,
      level,
      message: redactLogText(message),
      requestId: input.requestId ?? options.bindings?.requestId,
      service: options.service,
      spanId: spanContext?.spanId,
      tenantId: input.tenantId ?? options.bindings?.tenantId,
      timestamp: now().toISOString(),
      traceId: spanContext?.traceId,
    };

    await Promise.allSettled(
      options.transports.map((transport) => transport.write(record)),
    );

    return record;
  }

  return {
    child(bindings: LoggerContext) {
      return createLogger({
        ...options,
        bindings: {
          ...options.bindings,
          ...bindings,
          attributes: {
            ...(options.bindings?.attributes ?? {}),
            ...(bindings.attributes ?? {}),
          },
        },
        now,
      });
    },
    debug: (message: string, input?: LoggerContext & { error?: unknown }) =>
      write("debug", message, input),
    error: (message: string, input?: LoggerContext & { error?: unknown }) =>
      write("error", message, input),
    fatal: (message: string, input?: LoggerContext & { error?: unknown }) =>
      write("fatal", message, input),
    info: (message: string, input?: LoggerContext & { error?: unknown }) =>
      write("info", message, input),
    security: (
      level: Exclude<LogLevel, "debug">,
      message: string,
      input?: Omit<LoggerContext, "category"> & { error?: unknown },
    ) => write(level, message, { ...input, category: "security" }),
    warn: (message: string, input?: LoggerContext & { error?: unknown }) =>
      write("warn", message, input),
  };
}

export type StructuredLogger = ReturnType<typeof createLogger>;
