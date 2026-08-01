export type MessageChannel = "email" | "in_app" | "push" | "sms";

export type MessageLocale = "ar" | "en" | (string & {});

export type MessageBrand = {
  accentColor?: string;
  direction?: "ltr" | "rtl";
  logoUrl?: string;
  name: string;
  supportEmail?: string;
};

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export type EmailAddress = {
  email: string;
  name?: string;
};

export type EmailSendInput = RenderedEmail & {
  from: EmailAddress;
  headers?: Record<string, string>;
  replyTo?: EmailAddress;
  tags?: Record<string, string>;
  to: EmailAddress[];
};

export type EmailSendResult = {
  accepted: boolean;
  messageId: string;
  provider: string;
  raw?: Record<string, unknown>;
};

export type EmailProvider = {
  id: string;
  send(input: EmailSendInput): Promise<EmailSendResult>;
};

export type SmsSendInput = {
  body: string;
  from?: string;
  tags?: Record<string, string>;
  to: string;
};

export type SmsProvider = {
  id: string;
  send(input: SmsSendInput): Promise<{ messageId: string; provider: string }>;
};

export type PushSendInput = {
  body: string;
  data?: Record<string, string>;
  title: string;
  tokens: string[];
};

export type PushProvider = {
  id: string;
  send(input: PushSendInput): Promise<{ messageId: string; provider: string }>;
};

export type TransactionalEmailTemplateInput = {
  actionLabel?: string;
  actionUrl?: string;
  body: string;
  brand: MessageBrand;
  locale: MessageLocale;
  preheader?: string;
  subject: string;
  title: string;
};

export type EmailTemplateRenderer = (
  templateKey: string,
  payload: Record<string, unknown>,
  context: {
    brand: MessageBrand;
    locale: MessageLocale;
  },
) => Promise<RenderedEmail>;

export type NotificationPreference = {
  emailEnabled: boolean;
  eventType: string;
  inAppEnabled: boolean;
  locale?: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  tenantId?: string;
  updatedAt: string;
  userId: string;
};

export type InAppNotification = {
  actionUrl?: string;
  body: string;
  createdAt: string;
  dismissedAt?: string;
  eventType: string;
  id: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  tenantId?: string;
  title: string;
  userId: string;
};

export type MessageDelivery = {
  attempts: number;
  channel: MessageChannel;
  createdAt: string;
  eventType: string;
  failedAt?: string;
  id: string;
  lastError?: string;
  locale: string;
  maxAttempts: number;
  provider: string;
  providerMessageId?: string;
  recipient: string;
  sentAt?: string;
  status: "failed" | "queued" | "sending" | "sent" | "suppressed";
  subject?: string;
  templateKey: string;
  tenantId?: string;
  updatedAt: string;
  userId?: string;
};
