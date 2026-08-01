import path from "node:path";

import {
  createMailgunEmailProvider,
  createPostmarkEmailProvider,
  createPreviewEmailProvider,
  createResendEmailProvider,
  createSmtpEmailProvider,
} from "./adapters";
import type { EmailAddress, EmailProvider, MessageBrand } from "./types";

export type EmailRuntimeConfiguration = {
  brand: MessageBrand;
  from: EmailAddress;
  provider: EmailProvider;
};

function required(source: Record<string, string | undefined>, key: string) {
  const value = source[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for the selected email provider.`);
  }

  return value;
}

function parseAddress(value: string): EmailAddress {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);

  return match
    ? { email: match[2]!.trim(), name: match[1]!.trim() || undefined }
    : { email: value.trim() };
}

function numberValue(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

export function createEmailRuntimeConfiguration(
  source: Record<string, string | undefined> = process.env,
): EmailRuntimeConfiguration {
  const providerName =
    source.EMAIL_PROVIDER?.trim().toLowerCase() ||
    (source.SMTP_HOST ? "smtp" : "preview");
  const from = parseAddress(
    source.EMAIL_FROM?.trim() ||
      source.SMTP_FROM?.trim() ||
      "SaaS Starter <no-reply@example.test>",
  );
  let provider: EmailProvider;

  if (providerName === "smtp") {
    const secure = source.SMTP_SECURE?.trim().toLowerCase();

    if (secure && secure !== "true" && secure !== "false") {
      throw new Error("SMTP_SECURE must be either true or false.");
    }

    provider = createSmtpEmailProvider({
      host: required(source, "SMTP_HOST"),
      password: source.SMTP_PASSWORD?.trim() || undefined,
      port: numberValue(source.SMTP_PORT, 1025),
      secure: secure ? secure === "true" : undefined,
      user: source.SMTP_USER?.trim() || undefined,
    });
  } else if (providerName === "resend") {
    provider = createResendEmailProvider({
      apiKey: required(source, "RESEND_API_KEY"),
      baseUrl: source.RESEND_API_BASE_URL?.trim() || undefined,
    });
  } else if (providerName === "postmark") {
    provider = createPostmarkEmailProvider({
      baseUrl: source.POSTMARK_API_BASE_URL?.trim() || undefined,
      serverToken: required(source, "POSTMARK_SERVER_TOKEN"),
    });
  } else if (providerName === "mailgun") {
    provider = createMailgunEmailProvider({
      apiKey: required(source, "MAILGUN_API_KEY"),
      baseUrl: source.MAILGUN_API_BASE_URL?.trim() || undefined,
      domain: required(source, "MAILGUN_DOMAIN"),
    });
  } else if (providerName === "preview") {
    provider = createPreviewEmailProvider({
      directory:
        source.EMAIL_PREVIEW_DIR?.trim() ||
        path.join(process.cwd(), ".local", "emails"),
    });
  } else {
    throw new Error(`Unsupported email provider: ${providerName}`);
  }

  return {
    brand: {
      accentColor: source.EMAIL_BRAND_ACCENT?.trim() || undefined,
      logoUrl: source.EMAIL_BRAND_LOGO_URL?.trim() || undefined,
      name: source.EMAIL_BRAND_NAME?.trim() || "SaaS Starter",
      supportEmail: source.EMAIL_SUPPORT_ADDRESS?.trim() || undefined,
    },
    from,
    provider,
  };
}
