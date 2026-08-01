/* eslint-disable @next/next/no-head-element, @next/next/no-img-element -- Transactional email HTML is not rendered by Next.js. */

import type {
  MessageBrand,
  MessageLocale,
  TransactionalEmailTemplateInput,
} from "./types";

function direction(locale: MessageLocale, brand: MessageBrand) {
  return (
    brand.direction ?? (locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr")
  );
}

export function TransactionalEmailTemplate(
  input: TransactionalEmailTemplateInput,
) {
  const dir = direction(input.locale, input.brand);
  const accentColor = input.brand.accentColor ?? "#2563eb";

  return (
    <html dir={dir} lang={input.locale}>
      <head />
      <body
        style={{
          backgroundColor: "#f8fafc",
          direction: dir,
          fontFamily: "Arial, sans-serif",
          margin: 0,
          padding: "32px 12px",
        }}
      >
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
          {input.preheader ?? input.subject}
        </div>
        <table
          role="presentation"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            margin: "0 auto",
            maxWidth: "560px",
            width: "100%",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "32px" }}>
                {input.brand.logoUrl ? (
                  <div style={{ marginBottom: "20px" }}>
                    <img
                      alt={input.brand.name}
                      height="40"
                      src={input.brand.logoUrl}
                      style={{ display: "block", maxWidth: "180px" }}
                    />
                  </div>
                ) : (
                  <p style={{ color: accentColor, fontWeight: 700 }}>
                    {input.brand.name}
                  </p>
                )}
                <h1 style={{ color: "#0f172a", fontSize: "24px" }}>
                  {input.title}
                </h1>
                <p
                  style={{
                    color: "#334155",
                    fontSize: "16px",
                    lineHeight: "24px",
                  }}
                >
                  {input.body}
                </p>
                {input.actionLabel && input.actionUrl ? (
                  <div style={{ margin: "28px 0" }}>
                    <a
                      href={input.actionUrl}
                      style={{
                        backgroundColor: accentColor,
                        borderRadius: "8px",
                        color: "#ffffff",
                        display: "inline-block",
                        fontWeight: 700,
                        padding: "12px 20px",
                        textDecoration: "none",
                      }}
                    >
                      {input.actionLabel}
                    </a>
                  </div>
                ) : null}
                <hr style={{ borderColor: "#e2e8f0", margin: "28px 0" }} />
                <p style={{ color: "#64748b", fontSize: "12px" }}>
                  {input.brand.supportEmail ? (
                    <a href={`mailto:${input.brand.supportEmail}`}>
                      {input.brand.supportEmail}
                    </a>
                  ) : (
                    input.brand.name
                  )}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
