import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EmailProvider } from "../types";

export function createPreviewEmailProvider(options: {
  directory: string;
  id?: string;
}): EmailProvider {
  return {
    id: options.id ?? "preview",
    async send(input) {
      const messageId = randomUUID();
      const basePath = path.resolve(options.directory, messageId);

      await mkdir(path.dirname(basePath), { recursive: true });
      await Promise.all([
        writeFile(`${basePath}.html`, input.html, "utf8"),
        writeFile(`${basePath}.txt`, input.text, "utf8"),
        writeFile(
          `${basePath}.json`,
          JSON.stringify(
            {
              from: input.from,
              headers: input.headers,
              replyTo: input.replyTo,
              subject: input.subject,
              tags: input.tags,
              to: input.to,
            },
            null,
            2,
          ),
          "utf8",
        ),
      ]);

      return {
        accepted: true,
        messageId,
        provider: this.id,
        raw: { previewPath: `${basePath}.html` },
      };
    },
  };
}
