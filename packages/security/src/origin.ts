function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

function splitHostPort(host: string) {
  const match = host.match(/:(\d+)$/u);

  return match
    ? {
        hostname: host.slice(0, -match[0].length),
        port: match[1],
      }
    : { hostname: host, port: undefined };
}

function normalizeHostPattern(value: string) {
  const wildcard = value.startsWith("*.");
  const host = wildcard ? value.slice(2) : value;
  const { port } = splitHostPort(host);
  const parsed = new URL(`https://${host}`);

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Invalid origin host pattern.");
  }

  const normalizedHost = `${parsed.hostname}${port ? `:${Number(port)}` : ""}`;

  return wildcard ? `*.${normalizedHost}` : normalizedHost;
}

function normalizeAllowedOrigin(value: string) {
  if (value === "*") {
    return value;
  }

  const wildcardUrl = value.match(/^([a-z][a-z\d+.-]*:\/\/)\*\.(.+)$/iu);

  if (wildcardUrl) {
    const protocol = new URL(`${wildcardUrl[1]}${wildcardUrl[2]}`).protocol;
    return `${protocol}//${normalizeHostPattern(`*.${wildcardUrl[2]}`)}`;
  }

  return value.includes("://")
    ? normalizeOrigin(value)
    : normalizeHostPattern(value);
}

function matchesHostPattern(origin: URL, pattern: string) {
  const wildcard = pattern.startsWith("*.");
  const { hostname: hostPattern, port } = splitHostPort(
    wildcard ? pattern.slice(2) : pattern,
  );
  const allowed = new URL(`https://${hostPattern}`);
  const hostnameMatches = wildcard
    ? origin.hostname.endsWith(`.${allowed.hostname}`)
    : origin.hostname === allowed.hostname;
  const effectivePort =
    origin.port ||
    (origin.protocol === "https:"
      ? "443"
      : origin.protocol === "http:"
        ? "80"
        : "");
  const portMatches = port ? effectivePort === port : origin.port === "";

  return hostnameMatches && portMatches;
}

function matchesAllowedOrigin(origin: URL, pattern: string) {
  if (pattern === "*") {
    return true;
  }

  const separatorIndex = pattern.indexOf("://");

  if (separatorIndex === -1) {
    return matchesHostPattern(origin, pattern);
  }

  const protocol = pattern.slice(0, separatorIndex + 1);
  const hostPattern = pattern.slice(separatorIndex + 3);

  return (
    origin.protocol === protocol &&
    (hostPattern.startsWith("*.")
      ? matchesHostPattern(origin, hostPattern)
      : origin.origin === pattern)
  );
}

export function getAllowedOrigins(input: {
  appBaseUrl: string;
  configuredOrigins?: string;
}) {
  return [
    ...new Set(
      [input.appBaseUrl, ...(input.configuredOrigins ?? "").split(",")]
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map(normalizeAllowedOrigin),
    ),
  ];
}

export function isOriginAllowed(
  origin: string | null | undefined,
  allowedOrigins: readonly string[],
) {
  if (!origin) {
    return false;
  }

  let normalized: URL;
  try {
    normalized = new URL(origin);
  } catch {
    return false;
  }

  return allowedOrigins.some((allowedOrigin) =>
    matchesAllowedOrigin(normalized, allowedOrigin),
  );
}

export function createCorsHeaders(input: {
  allowedOrigins: readonly string[];
  origin?: string | null;
}) {
  const headers: Record<string, string> = {
    "access-control-allow-headers":
      "authorization,content-type,idempotency-key,x-request-id",
    "access-control-allow-methods": "DELETE,GET,OPTIONS,POST,PUT",
    "access-control-max-age": "86400",
    vary: "Origin",
  };

  if (input.allowedOrigins.includes("*")) {
    headers["access-control-allow-origin"] = "*";
  } else if (isOriginAllowed(input.origin, input.allowedOrigins)) {
    headers["access-control-allow-origin"] = normalizeOrigin(input.origin!);
  }

  return headers;
}

export function assertTrustedOrigin(input: {
  allowedOrigins: readonly string[];
  host?: string | null;
  origin?: string | null;
  protocol?: string | null;
  requireOrigin?: boolean;
}) {
  const hostOrigin = input.host
    ? `${input.protocol ?? "https"}://${input.host}`
    : undefined;
  const allowedOrigins = [
    ...input.allowedOrigins,
    ...(hostOrigin ? [normalizeOrigin(hostOrigin)] : []),
  ];

  if (!input.origin && !input.requireOrigin) {
    return;
  }

  if (!isOriginAllowed(input.origin, allowedOrigins)) {
    throw new Error("Request origin is not allowed.");
  }
}

export function getClientAddress(
  headers: Pick<Headers, "get">,
  trustedProxyCount = 0,
) {
  const direct = headers.get("x-real-ip")?.trim();
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (trustedProxyCount > 0 && forwarded.length > 0) {
    return (
      forwarded[Math.max(0, forwarded.length - trustedProxyCount)] ?? direct
    );
  }

  return trustedProxyCount > 0 ? direct : undefined;
}
