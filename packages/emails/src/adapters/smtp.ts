import nodemailer from "nodemailer";

import type { EmailProvider } from "../types";

export type SmtpEmailProviderOptions = {
  host: string;
  id?: string;
  password?: string;
  port: number;
  secure?: boolean;
  user?: string;
};

function formatAddress(address: { email: string; name?: string }) {
  return address.name
    ? { address: address.email, name: address.name }
    : address.email;
}

export function createSmtpEmailProvider(
  options: SmtpEmailProviderOptions,
): EmailProvider {
  const transport = nodemailer.createTransport({
    auth:
      options.user && options.password
        ? { pass: options.password, user: options.user }
        : undefined,
    host: options.host,
    port: options.port,
    secure: options.secure ?? options.port === 465,
  });

  return {
    id: options.id ?? "smtp",
    async send(input) {
      const result = await transport.sendMail({
        from: formatAddress(input.from),
        headers: input.headers,
        html: input.html,
        replyTo: input.replyTo ? formatAddress(input.replyTo) : undefined,
        subject: input.subject,
        text: input.text,
        to: input.to.map(formatAddress),
      });

      return {
        accepted: result.accepted.length > 0,
        messageId: result.messageId,
        provider: this.id,
        raw: {
          accepted: result.accepted.map(String),
          rejected: result.rejected.map(String),
          response: result.response,
        },
      };
    },
  };
}
