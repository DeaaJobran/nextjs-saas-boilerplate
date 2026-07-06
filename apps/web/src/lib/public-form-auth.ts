import { headers } from "next/headers";

export async function requirePublicFormAuth() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");

  if (!origin || !host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Public form submissions require origin and host headers.",
      );
    }

    return;
  }

  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "http";
  const sameOrigin = `${forwardedProto}://${host}`;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const allowedOrigins = new Set(
    [sameOrigin, configuredOrigin].filter((value): value is string =>
      Boolean(value),
    ),
  );

  if (!allowedOrigins.has(origin)) {
    throw new Error("Public form submission origin is not allowed.");
  }
}
