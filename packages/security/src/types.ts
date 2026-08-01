export type SecuritySeverity = "critical" | "high" | "info" | "low" | "medium";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
};

export type LegalAcceptance = {
  acceptedAt: string;
  contentHash: string;
  documentId?: string;
  documentSlug: string;
  id: string;
  locale: string;
  metadata: Record<string, unknown>;
  tenantId?: string;
  userId: string;
  version: string;
};

export type PrivacyRequestType = "account_deletion" | "data_export";
export type PrivacyRequestStatus =
  "completed" | "failed" | "processing" | "requested";

export type PrivacyRequest = {
  completedAt?: string;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  reason?: string;
  result: Record<string, unknown>;
  status: PrivacyRequestStatus;
  tenantId?: string;
  type: PrivacyRequestType;
  updatedAt: string;
  userId: string;
};

export type PrivacyExport = {
  generatedAt: string;
  requestId: string;
  schemaVersion: "1";
  sections: Record<string, unknown[]>;
  userId: string;
};

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}
