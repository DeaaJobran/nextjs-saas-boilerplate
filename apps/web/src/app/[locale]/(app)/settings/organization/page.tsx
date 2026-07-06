import { type TenantPermission } from "@nextjs-saas/tenant";
import { getTranslations } from "next-intl/server";

import { getContentRepository } from "../../../../../lib/content-store";
import { assertLocale } from "../../../../../lib/locale";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../../lib/tenant";
import { OrganizationSettingsContent } from "./organization-settings-sections";

type OrganizationSettingsSearchParams = {
  status?: string;
};

function hasPermission(
  permissions: readonly TenantPermission[],
  permission: TenantPermission,
) {
  return permissions.includes(permission);
}

function statusMessage(
  status: string | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  switch (status) {
    case "api-key-created":
      return t("status.api-key-created");
    case "api-key-revoked":
      return t("status.api-key-revoked");
    case "feature-flag-updated":
      return t("status.feature-flag-updated");
    case "invalid-role":
      return t("status.invalid-role");
    case "invalid-locale":
      return t("status.invalid-locale");
    case "invitation-cancelled":
      return t("status.invitation-cancelled");
    case "member-invited":
      return t("status.member-invited");
    case "member-removed":
      return t("status.member-removed");
    case "member-updated":
      return t("status.member-updated");
    case "organization-updated":
      return t("status.organization-updated");
    case "quota-updated":
      return t("status.quota-updated");
    case "usage-limit-updated":
      return t("status.usage-limit-updated");
    default:
      return undefined;
  }
}

export default async function OrganizationSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<OrganizationSettingsSearchParams>;
}) {
  const fallbackSearchParams: Promise<OrganizationSettingsSearchParams> =
    Promise.resolve({});
  const [{ locale }, statusParams, t, context] = await Promise.all([
    params,
    searchParams ?? fallbackSearchParams,
    getTranslations("OrganizationSettings"),
    getActiveTenantContext("organization.read"),
  ]);
  const resolvedLocale = assertLocale(locale);
  const tenant = getTenantService();
  const [
    members,
    invitations,
    featureFlags,
    usageLimits,
    quota,
    apiKeys,
    auditEvents,
    contentRepository,
  ] = await Promise.all([
    tenant.listMembers({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    tenant.listInvitations({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    tenant.listFeatureFlags({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    tenant.listUsageLimits({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    tenant.getQuota({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    hasPermission(context.membership.permissions, "api_keys.manage")
      ? tenant.listTenantApiKeys({
          actorId: context.effectiveUser.id,
          organizationId: context.organization.id,
        })
      : Promise.resolve([]),
    hasPermission(context.membership.permissions, "audit.read")
      ? tenant.listAuditEvents({
          actorId: context.effectiveUser.id,
          organizationId: context.organization.id,
        })
      : Promise.resolve([]),
    getContentRepository(),
  ]);
  const capabilities = {
    canInvite: hasPermission(context.membership.permissions, "members.invite"),
    canManageFlags: hasPermission(
      context.membership.permissions,
      "feature_flags.manage",
    ),
    canManageKeys: hasPermission(
      context.membership.permissions,
      "api_keys.manage",
    ),
    canManageLimits: hasPermission(
      context.membership.permissions,
      "limits.manage",
    ),
    canRejectInvitations: hasPermission(
      context.membership.permissions,
      "invitations.reject",
    ),
    canRemoveMembers: hasPermission(
      context.membership.permissions,
      "members.remove",
    ),
    canUpdateMembers: hasPermission(
      context.membership.permissions,
      "members.update",
    ),
    canUpdateOrganization: hasPermission(
      context.membership.permissions,
      "organization.update",
    ),
  };

  return (
    <OrganizationSettingsContent
      apiKeys={apiKeys}
      auditEvents={auditEvents}
      capabilities={capabilities}
      context={context}
      enabledLocales={contentRepository.listEnabledLocales()}
      featureFlags={featureFlags}
      invitations={invitations}
      members={members}
      message={statusMessage(statusParams.status, t)}
      quota={quota}
      resolvedLocale={resolvedLocale}
      shouldLoadApiKeySecret={statusParams.status === "api-key-created"}
      t={t}
      usageLimits={usageLimits}
    />
  );
}
