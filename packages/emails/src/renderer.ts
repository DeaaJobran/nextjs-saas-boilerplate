import { render, toPlainText } from "@react-email/render";
import { createElement } from "react";

import { TransactionalEmailTemplate } from "./templates";
import type {
  EmailTemplateRenderer,
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
    invitation: {
      action: "قبول الدعوة",
      body: "تمت دعوتك للانضمام إلى مؤسسة. استخدم الرابط الآمن أدناه لقبول الدعوة.",
      subject: "دعوة للانضمام",
      title: "اقبل دعوتك",
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
    invitation: {
      action: "Accept invitation",
      body: "You have been invited to join an organization. Use the secure link below to accept the invitation.",
      subject: "You're invited",
      title: "Accept your invitation",
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

  const html = await render(
    createElement(TransactionalEmailTemplate, template),
  );

  return {
    html,
    subject: template.subject,
    text: toPlainText(html),
  };
};
