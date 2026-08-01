import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMailgunEmailProvider,
  createPostmarkEmailProvider,
  createPreviewEmailProvider,
  createResendEmailProvider,
} from "./adapters";
import { createEmailRuntimeConfiguration } from "./config";
import { defaultEmailTemplateRenderer } from "./renderer";
import type { EmailSendInput } from "./types";

const email: EmailSendInput = {
  from: { email: "no-reply@example.test", name: "Example" },
  html: "<p>Hello</p>",
  subject: "Hello",
  text: "Hello",
  to: [{ email: "user@example.test", name: "Ada" }],
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("email adapters and templates", () => {
  it("renders branded localized React Email templates", async () => {
    const rendered = await defaultEmailTemplateRenderer(
      "auth.notification",
      {
        kind: "password_reset",
        link: "https://example.test/reset/token",
      },
      {
        brand: { accentColor: "#123456", name: "Acme" },
        locale: "ar",
      },
    );

    expect(rendered.subject).toBe("إعادة تعيين كلمة المرور");
    expect(rendered.html).toContain('dir="rtl"');
    expect(rendered.html).toContain("https://example.test/reset/token");
    expect(rendered.text).toContain("Acme");
  });

  it("writes local previews without sending externally", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "email-preview-"));
    temporaryDirectories.push(directory);
    const provider = createPreviewEmailProvider({ directory });

    const result = await provider.send(email);
    const html = await readFile(
      path.join(directory, `${result.messageId}.html`),
      "utf8",
    );

    expect(result.accepted).toBe(true);
    expect(html).toBe(email.html);
  });

  it.each([
    {
      create: (request: typeof fetch) =>
        createResendEmailProvider({ apiKey: "token", fetch: request }),
      response: { id: "resend-1" },
    },
    {
      create: (request: typeof fetch) =>
        createPostmarkEmailProvider({
          fetch: request,
          serverToken: "token",
        }),
      response: { ErrorCode: 0, MessageID: "postmark-1" },
    },
    {
      create: (request: typeof fetch) =>
        createMailgunEmailProvider({
          apiKey: "token",
          domain: "mail.example.test",
          fetch: request,
        }),
      response: { id: "mailgun-1" },
    },
  ])("sends through the $create HTTP adapter", async ({ create, response }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const provider = create(request);

    const result = await provider.send(email);

    expect(result.accepted).toBe(true);
    expect(result.messageId).toBeTruthy();
    expect(request).toHaveBeenCalledOnce();
  });

  it("selects providers from runtime configuration", () => {
    const preview = createEmailRuntimeConfiguration({
      EMAIL_BRAND_NAME: "Acme",
      EMAIL_FROM: "Acme <no-reply@acme.test>",
      EMAIL_PREVIEW_DIR: ".local/test-emails",
      EMAIL_PROVIDER: "preview",
    });

    expect(preview.provider.id).toBe("preview");
    expect(preview.brand.name).toBe("Acme");
    expect(preview.from).toEqual({
      email: "no-reply@acme.test",
      name: "Acme",
    });
    expect(() =>
      createEmailRuntimeConfiguration({ EMAIL_PROVIDER: "resend" }),
    ).toThrow(/RESEND_API_KEY/);
  });
});
