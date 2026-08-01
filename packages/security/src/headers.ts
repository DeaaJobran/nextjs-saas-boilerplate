export type SecurityHeader = { key: string; value: string };

function sourceList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean);
}

export function createContentSecurityPolicy(
  source: Record<string, string | undefined> = process.env,
) {
  const production = source.NODE_ENV === "production";
  const connectSources = [
    "'self'",
    ...sourceList(source.SECURITY_CSP_CONNECT_SRC),
    ...(production ? [] : ["ws:", "wss:"]),
  ];
  const imageSources = [
    "'self'",
    "blob:",
    "data:",
    ...sourceList(source.SECURITY_CSP_IMAGE_SRC),
  ];
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(production ? [] : ["'unsafe-eval'"]),
  ];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `img-src ${imageSources.join(" ")}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export function createSecurityHeaders(
  source: Record<string, string | undefined> = process.env,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: createContentSecurityPolicy(source),
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (source.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
