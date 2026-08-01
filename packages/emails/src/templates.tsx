/* eslint-disable @next/next/no-head-element, @next/next/no-img-element -- Transactional email HTML is not rendered by Next.js. */

import { render, toPlainText } from "@react-email/render";

import type {
  EmailTemplateRenderer,
  MessageBrand,
  MessageLocale,
  TransactionalEmailTemplateInput,
} from "./types";

const authCopy = {
  ar: {
    account_deletion: {
      action: "تأكيد حذف الحساب",
      body: "استخدم الرابط الآمن أدناه لتأكيد طلب حذف حسابك.",
      subject: "تأكيد حذف الحساب",
      title: "تأكيد حذف حسابك",
    },
    email_change: {
      action: "تأكيد البريد الإلكتروني",
      body: "استخدم الرابط الآمن أدناه لتأكيد عنوان بريدك الإلكتروني الجديد.",
      subject: "تأكيد تغيير البريد الإلكتروني",
      title: "تأكيد بريدك الإلكتروني الجديد",
    },
    email_verification: {
      action: "تأكيد البريد الإلكتروني",
      body: "استخدم الرابط الآمن أدناه لتأكيد عنوان بريدك الإلكتروني.",
      subject: "تأكيد البريد الإلكتروني",
      title: "أكمل إعداد حسابك",
    },
    magic_link: {
      action: "تسجيل الدخول",
      body: "استخدم الرابط الآمن أدناه لتسجيل الدخول. تجاهل هذه الرسالة إذا لم تطلبها.",
      subject: "رابط تسجيل الدخول الآمن",
      title: "تسجيل الدخول إلى حسابك",
    },
    password_reset: {
      action: "إعادة تعيين كلمة المرور",
      body: "استخدم الرابط الآمن أدناه لإعادة تعيين كلمة المرور. تجاهل هذه الرسالة إذا لم تطلبها.",
      subject: "إعادة تعيين كلمة المرور",
      title: "أنشئ كلمة مرور جديدة",
    },
  },
  en: {
    account_deletion: {
      action: "Confirm account deletion",
      body: "Use the secure link below to confirm your account deletion request.",
      subject: "Confirm account deletion",
      title: "Confirm deletion of your account",
    },
    email_change: {
      action: "Verify email",
      body: "Use the secure link below to verify your new email address.",
      subject: "Verify your email change",
      title: "Verify your new email address",
    },
    email_verification: {
      action: "Verify email",
      body: "Use the secure link below to verify your email address.",
      subject: "Verify your email address",
      title: "Finish setting up your account",
    },
    magic_link: {
      action: "Sign in",
      body: "Use the secure link below to sign in. Ignore this message if you did not request it.",
      subject: "Your secure sign-in link",
      title: "Sign in to your account",
    },
    password_reset: {
      action: "Reset password",
      body: "Use the secure link below to reset your password. Ignore this message if you did not request it.",
      subject: "Reset your password",
      title: "Create a new password",
    },
  },
} as const;

type AuthNotificationKind = keyof (typeof authCopy)["en"];

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

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

export const defaultEmailTemplateRenderer: EmailTemplateRenderer = async (
  templateKey,
  payload,
  context,
) => {
  let template: TransactionalEmailTemplateInput;

  if (templateKey === "auth.notification") {
    const requestedKind = stringValue(payload, "kind") ?? "magic_link";
    const kind = (
      requestedKind in authCopy.en ? requestedKind : "magic_link"
    ) as AuthNotificationKind;
    const locale = context.locale.toLowerCase().startsWith("ar") ? "ar" : "en";
    const copy = authCopy[locale][kind];

    template = {
      actionLabel: copy.action,
      actionUrl: stringValue(payload, "link"),
      body: copy.body,
      brand: context.brand,
      locale: context.locale,
      subject: copy.subject,
      title: copy.title,
    };
  } else {
    template = {
      actionLabel: stringValue(payload, "actionLabel"),
      actionUrl: stringValue(payload, "actionUrl"),
      body: stringValue(payload, "body") ?? "",
      brand: context.brand,
      locale: context.locale,
      preheader: stringValue(payload, "preheader"),
      subject: stringValue(payload, "subject") ?? context.brand.name,
      title: stringValue(payload, "title") ?? context.brand.name,
    };
  }

  const html = await render(<TransactionalEmailTemplate {...template} />);

  return {
    html,
    subject: template.subject,
    text: toPlainText(html),
  };
};
