import type { EmailAddress, EmailProvider, EmailSendInput } from "../types";

type Fetch = typeof fetch;

function address(value: EmailAddress) {
  return value.name ? `${value.name} <${value.email}>` : value.email;
}

async function responsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { body: text };
  }
}

async function assertProviderResponse(provider: string, response: Response) {
  const payload = await responsePayload(response);

  if (!response.ok) {
    const detail =
      typeof payload.message === "string"
        ? payload.message
        : `HTTP ${response.status}`;

    throw new Error(`${provider} email delivery failed: ${detail}`);
  }

  return payload;
}

export function createResendEmailProvider(options: {
  apiKey: string;
  baseUrl?: string;
  fetch?: Fetch;
  id?: string;
}): EmailProvider {
  const request = options.fetch ?? fetch;

  return {
    id: options.id ?? "resend",
    async send(input) {
      const response = await request(
        new URL("/emails", options.baseUrl ?? "https://api.resend.com"),
        {
          body: JSON.stringify({
            from: address(input.from),
            headers: input.headers,
            html: input.html,
            reply_to: input.replyTo ? address(input.replyTo) : undefined,
            subject: input.subject,
            tags: Object.entries(input.tags ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
            text: input.text,
            to: input.to.map(address),
          }),
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const payload = await assertProviderResponse(this.id, response);

      return {
        accepted: true,
        messageId: String(payload.id ?? ""),
        provider: this.id,
        raw: payload,
      };
    },
  };
}

export function createPostmarkEmailProvider(options: {
  baseUrl?: string;
  fetch?: Fetch;
  id?: string;
  serverToken: string;
}): EmailProvider {
  const request = options.fetch ?? fetch;

  return {
    id: options.id ?? "postmark",
    async send(input) {
      const response = await request(
        new URL("/email", options.baseUrl ?? "https://api.postmarkapp.com"),
        {
          body: JSON.stringify({
            From: address(input.from),
            Headers: Object.entries(input.headers ?? {}).map(
              ([Name, Value]) => ({ Name, Value }),
            ),
            HtmlBody: input.html,
            ReplyTo: input.replyTo ? address(input.replyTo) : undefined,
            Subject: input.subject,
            Tag: input.tags ? Object.values(input.tags)[0] : undefined,
            TextBody: input.text,
            To: input.to.map(address).join(","),
          }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-postmark-server-token": options.serverToken,
          },
          method: "POST",
        },
      );
      const payload = await assertProviderResponse(this.id, response);

      return {
        accepted: Number(payload.ErrorCode ?? 0) === 0,
        messageId: String(payload.MessageID ?? ""),
        provider: this.id,
        raw: payload,
      };
    },
  };
}

export function createMailgunEmailProvider(options: {
  apiKey: string;
  baseUrl?: string;
  domain: string;
  fetch?: Fetch;
  id?: string;
}): EmailProvider {
  const request = options.fetch ?? fetch;

  return {
    id: options.id ?? "mailgun",
    async send(input: EmailSendInput) {
      const form = new URLSearchParams({
        from: address(input.from),
        html: input.html,
        subject: input.subject,
        text: input.text,
      });

      for (const recipient of input.to) {
        form.append("to", address(recipient));
      }

      if (input.replyTo) {
        form.set("h:Reply-To", address(input.replyTo));
      }

      for (const [key, value] of Object.entries(input.headers ?? {})) {
        form.set(`h:${key}`, value);
      }

      for (const [key, value] of Object.entries(input.tags ?? {})) {
        form.append("o:tag", `${key}:${value}`);
      }

      const baseUrl = options.baseUrl ?? "https://api.mailgun.net";
      const response = await request(
        new URL(`/v3/${encodeURIComponent(options.domain)}/messages`, baseUrl),
        {
          body: form,
          headers: {
            authorization: `Basic ${Buffer.from(`api:${options.apiKey}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        },
      );
      const payload = await assertProviderResponse(this.id, response);

      return {
        accepted: true,
        messageId: String(payload.id ?? ""),
        provider: this.id,
        raw: payload,
      };
    },
  };
}
