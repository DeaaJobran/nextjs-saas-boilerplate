"use server";

import { appRoutes } from "@nextjs-saas/config/app";
import {
  isTenantPermission,
  isTenantRole,
  type TenantPermission,
  type TenantRole,
} from "@nextjs-saas/tenant";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../../../lib/admin-auth";
import {
  getOptionalCurrentSession,
  requireCurrentSession,
} from "../../../lib/auth";
import {
  clearImpersonationCookie,
  getActiveTenantContext,
  getTenantService,
  setActiveOrganizationCookie,
  setImpersonationCookie,
} from "../../../lib/tenant";
import {
  parseTenantApiKeySecretFlash,
  tenantApiKeySecretCookieName,
} from "../../../lib/tenant-api-key-flash";

export type TenantApiKeySecretRevealState =
  | { status: "idle" }
  | { secret: string; status: "ready" }
  | { status: "unavailable" };

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function formNumber(formData: FormData, key: string) {
  const value = Number(formValue(formData, key));

  return Number.isFinite(value) ? value : 0;
}

function localizedPath(formData: FormData, path: string) {
  const locale = formValue(formData, "locale");

  return locale ? `/${locale}${path}` : path;
}

function redirectWithStatus(
  formData: FormData,
  path: string,
  status: string,
): never {
  redirect(`${localizedPath(formData, path)}?status=${status}`);
}

function permissionsFromForm(formData: FormData): TenantPermission[] {
  return formValue(formData, "customPermissions")
    .split(/\r?\n|,/)
    .map((permission) => permission.trim())
    .filter((permission): permission is TenantPermission =>
      isTenantPermission(permission),
    );
}

function roleFromForm(formData: FormData): TenantRole {
  const role = formValue(formData, "role");

  if (!isTenantRole(role)) {
    redirectWithStatus(
      formData,
      appRoutes.organizationSettings,
      "invalid-role",
    );
  }

  return role as TenantRole;
}

function impersonationTargetFromForm(formData: FormData) {
  const target = formValue(formData, "target");

  if (target) {
    let parsed: {
      organizationId?: unknown;
      subjectUserId?: unknown;
    };

    try {
      parsed = JSON.parse(target) as {
        organizationId?: unknown;
        subjectUserId?: unknown;
      };
    } catch {
      redirectWithStatus(
        formData,
        appRoutes.adminSuper,
        "invalid-impersonation-target",
      );
    }

    if (
      typeof parsed.organizationId === "string" &&
      typeof parsed.subjectUserId === "string"
    ) {
      return {
        organizationId: parsed.organizationId,
        subjectUserId: parsed.subjectUserId,
      };
    }

    redirectWithStatus(
      formData,
      appRoutes.adminSuper,
      "invalid-impersonation-target",
    );
  }

  return {
    organizationId: formValue(formData, "organizationId"),
    subjectUserId: formValue(formData, "subjectUserId"),
  };
}

export async function switchOrganizationAction(formData: FormData) {
  const session = await requireCurrentSession();
  const organizationId = formValue(formData, "organizationId");

  await getTenantService().requireMembership({
    organizationId,
    permission: "dashboard.read",
    userId: session.user.id,
  });
  await setActiveOrganizationCookie(organizationId);

  redirectWithStatus(formData, appRoutes.dashboard, "organization-switched");
}

export async function updateOrganizationAction(formData: FormData) {
  const context = await getActiveTenantContext("organization.update");

  await getTenantService().updateOrganization({
    actorId: context.effectiveUser.id,
    defaultLocale: formValue(formData, "defaultLocale") || undefined,
    description: formValue(formData, "description") || undefined,
    logoUrl: formValue(formData, "logoUrl") || undefined,
    name: formValue(formData, "name"),
    organizationId: context.organization.id,
    websiteUrl: formValue(formData, "websiteUrl") || undefined,
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "organization-updated",
  );
}

export async function inviteMemberAction(formData: FormData) {
  const context = await getActiveTenantContext("members.invite");

  await getTenantService().createInvitation({
    actorId: context.effectiveUser.id,
    customPermissions: permissionsFromForm(formData),
    email: formValue(formData, "email"),
    organizationId: context.organization.id,
    role: roleFromForm(formData),
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "member-invited",
  );
}

export async function cancelInvitationAction(formData: FormData) {
  const context = await getActiveTenantContext("invitations.reject");

  await getTenantService().cancelInvitation({
    actorId: context.effectiveUser.id,
    invitationId: formValue(formData, "invitationId"),
    organizationId: context.organization.id,
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "invitation-cancelled",
  );
}

export async function updateMemberAction(formData: FormData) {
  const context = await getActiveTenantContext("members.update");

  await getTenantService().updateMember({
    actorId: context.effectiveUser.id,
    customPermissions: permissionsFromForm(formData),
    organizationId: context.organization.id,
    role: roleFromForm(formData),
    userId: formValue(formData, "userId"),
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "member-updated",
  );
}

export async function removeMemberAction(formData: FormData) {
  const context = await getActiveTenantContext("members.remove");

  await getTenantService().removeMember({
    actorId: context.effectiveUser.id,
    organizationId: context.organization.id,
    userId: formValue(formData, "userId"),
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "member-removed",
  );
}

export async function acceptOrganizationInvitationAction(formData: FormData) {
  const session = await requireCurrentSession();
  const result = await getTenantService().acceptInvitation({
    token: formValue(formData, "token"),
    userEmail: session.user.email,
    userId: session.user.id,
  });

  await setActiveOrganizationCookie(result.organization.id);

  redirectWithStatus(formData, appRoutes.dashboard, "invitation-accepted");
}

export async function rejectOrganizationInvitationAction(formData: FormData) {
  const session = await requireCurrentSession();

  await getTenantService().rejectInvitation({
    token: formValue(formData, "token"),
    userEmail: session.user.email,
    userId: session.user.id,
  });

  redirectWithStatus(formData, appRoutes.dashboard, "invitation-rejected");
}

export async function createTenantApiKeyAction(formData: FormData) {
  const context = await getActiveTenantContext("api_keys.manage");
  const result = await getTenantService().createTenantApiKey({
    actorId: context.effectiveUser.id,
    name: formValue(formData, "name"),
    organizationId: context.organization.id,
    scopes: formValue(formData, "scopes").split(/\r?\n|,/),
  });
  const cookieStore = await cookies();

  cookieStore.set(
    tenantApiKeySecretCookieName,
    JSON.stringify({
      keyPrefix: result.apiKey.keyPrefix,
      organizationId: context.organization.id,
      secret: result.secret,
    }),
    {
      httpOnly: true,
      maxAge: 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "api-key-created",
  );
}

export async function revokeTenantApiKeyAction(formData: FormData) {
  const context = await getActiveTenantContext("api_keys.manage");

  await getTenantService().revokeTenantApiKey({
    actorId: context.effectiveUser.id,
    apiKeyId: formValue(formData, "apiKeyId"),
    organizationId: context.organization.id,
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "api-key-revoked",
  );
}

export async function updateFeatureFlagAction(formData: FormData) {
  const context = await getActiveTenantContext("feature_flags.manage");

  await getTenantService().updateFeatureFlag({
    actorId: context.effectiveUser.id,
    enabled: formData.get("enabled") === "on",
    key: formValue(formData, "key"),
    organizationId: context.organization.id,
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "feature-flag-updated",
  );
}

export async function updateUsageLimitAction(formData: FormData) {
  const context = await getActiveTenantContext("limits.manage");

  await getTenantService().updateUsageLimit({
    actorId: context.effectiveUser.id,
    key: formValue(formData, "key"),
    limitValue: formNumber(formData, "limitValue"),
    organizationId: context.organization.id,
    windowSeconds: formNumber(formData, "windowSeconds") || undefined,
  });

  redirectWithStatus(
    formData,
    appRoutes.organizationSettings,
    "usage-limit-updated",
  );
}

export async function updateQuotaAction(formData: FormData) {
  const context = await getActiveTenantContext("limits.manage");

  await getTenantService().updateQuota({
    actorId: context.effectiveUser.id,
    aiTokenLimit: formNumber(formData, "aiTokenLimit"),
    organizationId: context.organization.id,
    storageBytesLimit: formNumber(formData, "storageBytesLimit"),
  });

  redirectWithStatus(formData, appRoutes.organizationSettings, "quota-updated");
}

export async function startImpersonationAction(formData: FormData) {
  const session = await requireAdminSession();
  const target = impersonationTargetFromForm(formData);
  const impersonation = await getTenantService().startImpersonation({
    actorDisplayName: session.user.displayName,
    actorEmail: session.user.email,
    actorGlobalRole: session.user.role,
    actorId: session.user.id,
    organizationId: target.organizationId,
    reason: formValue(formData, "reason"),
    subjectUserId: target.subjectUserId,
  });

  await setImpersonationCookie(impersonation.id);
  await setActiveOrganizationCookie(impersonation.organizationId);

  redirectWithStatus(formData, appRoutes.dashboard, "impersonation-started");
}

export async function endImpersonationAction(formData: FormData) {
  const session =
    (await getOptionalCurrentSession()) ?? (await requireAdminSession());

  await getTenantService().endImpersonation({
    actorId: session.user.id,
    sessionId: formValue(formData, "impersonationSessionId"),
  });
  await clearImpersonationCookie();

  redirectWithStatus(formData, appRoutes.adminSuper, "impersonation-ended");
}

export async function revealTenantApiKeySecretAction(
  previousState: TenantApiKeySecretRevealState,
  formData: FormData,
): Promise<TenantApiKeySecretRevealState> {
  void previousState;
  void formData;

  const cookieStore = await cookies();
  const flash = parseTenantApiKeySecretFlash(
    cookieStore.get(tenantApiKeySecretCookieName)?.value,
  );

  cookieStore.delete(tenantApiKeySecretCookieName);

  if (!flash) {
    return { status: "unavailable" };
  }

  const context = await getActiveTenantContext("api_keys.manage");

  if (context.organization.id !== flash.organizationId) {
    return { status: "unavailable" };
  }

  return { secret: flash.secret, status: "ready" };
}
