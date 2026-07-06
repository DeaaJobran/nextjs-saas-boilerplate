import {
  tenantApiKeyScopeCatalog,
  type TenantPermission,
  tenantPermissionCatalog,
  type TenantRole,
  tenantRoleConfig,
} from "@nextjs-saas/tenant";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { KeyRoundIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { assertLocale } from "../../../../../lib/locale";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../../lib/tenant";
import {
  cancelInvitationAction,
  createTenantApiKeyAction,
  inviteMemberAction,
  removeMemberAction,
  revokeTenantApiKeyAction,
  updateFeatureFlagAction,
  updateMemberAction,
  updateOrganizationAction,
  updateQuotaAction,
  updateUsageLimitAction,
} from "../../tenant-actions";
import { ApiKeySecretNotice } from "./api-key-secret-notice";

type OrganizationSettingsSearchParams = {
  status?: string;
};

function hasPermission(
  permissions: readonly TenantPermission[],
  permission: TenantPermission,
) {
  return permissions.includes(permission);
}

function RoleSelect({
  ariaLabel,
  defaultValue,
  disabled = false,
  name = "role",
}: {
  ariaLabel?: string;
  defaultValue: TenantRole;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="border-input bg-background ring-offset-background focus-visible:ring-ring h-11 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      required
    >
      {tenantRoleConfig.assignableRoles.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

function permissionsText(permissions: readonly string[]) {
  return permissions.join("\n");
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
  ]);
  const canUpdateOrganization = hasPermission(
    context.membership.permissions,
    "organization.update",
  );
  const canInvite = hasPermission(
    context.membership.permissions,
    "members.invite",
  );
  const canRejectInvitations = hasPermission(
    context.membership.permissions,
    "invitations.reject",
  );
  const canUpdateMembers = hasPermission(
    context.membership.permissions,
    "members.update",
  );
  const canManageKeys = hasPermission(
    context.membership.permissions,
    "api_keys.manage",
  );
  const canManageLimits = hasPermission(
    context.membership.permissions,
    "limits.manage",
  );
  const canManageFlags = hasPermission(
    context.membership.permissions,
    "feature_flags.manage",
  );
  const numberFormatter = new Intl.NumberFormat(resolvedLocale);
  const dateTimeFormatter = new Intl.DateTimeFormat(resolvedLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const message = statusMessage(statusParams.status, t);
  const shouldLoadApiKeySecret = statusParams.status === "api-key-created";

  return (
    <div className="grid gap-6">
      {message ? (
        <p
          className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <ApiKeySecretNotice
        description={t("apiKeys.secretDescription")}
        enabled={shouldLoadApiKeySecret}
        loadingLabel={t("apiKeys.secretLoading")}
        revealLabel={t("apiKeys.secretReveal")}
        title={t("apiKeys.secretTitle")}
        unavailableLabel={t("apiKeys.secretUnavailable")}
      />
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.title")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("profile.description")}
            </p>
          </CardHeader>
          <CardContent>
            <form action={updateOrganizationAction} className="grid gap-4">
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Field label={t("profile.name")} required>
                <TextInput
                  defaultValue={context.organization.name}
                  disabled={!canUpdateOrganization}
                  name="name"
                  required
                />
              </Field>
              <Field label={t("profile.descriptionField")}>
                <Textarea
                  defaultValue={context.organization.description}
                  disabled={!canUpdateOrganization}
                  name="description"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("profile.website")}>
                  <TextInput
                    defaultValue={context.organization.websiteUrl}
                    disabled={!canUpdateOrganization}
                    name="websiteUrl"
                    type="url"
                  />
                </Field>
                <Field label={t("profile.logo")}>
                  <TextInput
                    defaultValue={context.organization.logoUrl}
                    disabled={!canUpdateOrganization}
                    name="logoUrl"
                    type="url"
                  />
                </Field>
              </div>
              <Field label={t("profile.locale")}>
                <TextInput
                  defaultValue={context.organization.defaultLocale}
                  disabled={!canUpdateOrganization}
                  name="defaultLocale"
                />
              </Field>
              <Button disabled={!canUpdateOrganization} type="submit">
                {t("profile.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("permissions.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="outline">
              {context.membership.role}
            </Badge>
            <div className="grid gap-2">
              {context.membership.permissions.map((permission) => (
                <span
                  className="bg-muted rounded-md px-2 py-1 text-xs"
                  key={permission}
                >
                  {permission}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlusIcon aria-hidden="true" className="size-5" />
              {t("invite.title")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("invite.description")}
            </p>
          </CardHeader>
          <CardContent>
            <form action={inviteMemberAction} className="grid gap-4">
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Field label={t("invite.email")} required>
                <TextInput
                  disabled={!canInvite}
                  name="email"
                  required
                  type="email"
                />
              </Field>
              <Field label={t("invite.role")} required>
                <RoleSelect
                  defaultValue={tenantRoleConfig.defaultInviteRole}
                  disabled={!canInvite}
                />
              </Field>
              <Field
                description={t("invite.permissionsDescription")}
                label={t("invite.permissions")}
              >
                <Textarea
                  disabled={!canInvite}
                  name="customPermissions"
                  placeholder={tenantPermissionCatalog.join("\n")}
                />
              </Field>
              <Button disabled={!canInvite} type="submit">
                {t("invite.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("invitations.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (invitation) => invitation.email,
                  header: t("invitations.email"),
                  key: "email",
                },
                {
                  cell: (invitation) => invitation.role,
                  header: t("invitations.role"),
                  key: "role",
                },
                {
                  cell: (invitation) =>
                    invitation.acceptedAt
                      ? t("invitations.accepted")
                      : invitation.rejectedAt
                        ? t("invitations.rejected")
                        : t("invitations.pending"),
                  header: t("invitations.status"),
                  key: "status",
                },
                {
                  cell: (invitation) =>
                    invitation.acceptedAt || invitation.rejectedAt ? null : (
                      <form action={cancelInvitationAction}>
                        <input
                          name="invitationId"
                          type="hidden"
                          value={invitation.id}
                        />
                        <input
                          name="locale"
                          type="hidden"
                          value={resolvedLocale}
                        />
                        <Button
                          disabled={!canRejectInvitations}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          {t("invitations.cancel")}
                        </Button>
                      </form>
                    ),
                  header: t("invitations.action"),
                  key: "action",
                },
              ]}
              data={invitations}
              emptyLabel={t("invitations.empty")}
            />
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{t("members.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (member) => member.displayName,
                header: t("members.name"),
                key: "name",
              },
              {
                cell: (member) => member.email,
                header: t("members.email"),
                key: "email",
              },
              {
                cell: (member) => (
                  <form action={updateMemberAction} className="grid gap-2">
                    <input name="locale" type="hidden" value={resolvedLocale} />
                    <input name="userId" type="hidden" value={member.userId} />
                    <RoleSelect
                      ariaLabel={t("members.roleSelect")}
                      defaultValue={member.role}
                      disabled={!canUpdateMembers}
                    />
                    <Textarea
                      aria-label={t("invite.permissions")}
                      defaultValue={permissionsText(member.customPermissions)}
                      disabled={!canUpdateMembers}
                      name="customPermissions"
                    />
                    <Button
                      disabled={!canUpdateMembers}
                      size="sm"
                      type="submit"
                      variant="outline"
                    >
                      {t("members.update")}
                    </Button>
                  </form>
                ),
                header: t("members.role"),
                key: "role",
              },
              {
                cell: (member) => (
                  <form action={removeMemberAction}>
                    <input name="locale" type="hidden" value={resolvedLocale} />
                    <input name="userId" type="hidden" value={member.userId} />
                    <Button
                      disabled={
                        !hasPermission(
                          context.membership.permissions,
                          "members.remove",
                        )
                      }
                      size="sm"
                      type="submit"
                      variant="destructive"
                    >
                      {t("members.remove")}
                    </Button>
                  </form>
                ),
                header: t("members.action"),
                key: "action",
              },
            ]}
            data={members}
            emptyLabel={t("members.empty")}
          />
        </CardContent>
      </Card>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon aria-hidden="true" className="size-5" />
              {t("apiKeys.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={createTenantApiKeyAction} className="grid gap-4">
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Field label={t("apiKeys.name")} required>
                <TextInput disabled={!canManageKeys} name="name" required />
              </Field>
              <Field
                description={t("apiKeys.scopesDescription")}
                label={t("apiKeys.scopes")}
              >
                <Textarea
                  defaultValue={tenantApiKeyScopeCatalog[0]}
                  disabled={!canManageKeys}
                  name="scopes"
                  placeholder={tenantApiKeyScopeCatalog.join("\n")}
                />
              </Field>
              <Button disabled={!canManageKeys} type="submit">
                {t("apiKeys.create")}
              </Button>
            </form>
            <DataTable
              columns={[
                {
                  cell: (apiKey) => apiKey.name,
                  header: t("apiKeys.name"),
                  key: "name",
                },
                {
                  cell: (apiKey) => apiKey.keyPrefix,
                  header: t("apiKeys.prefix"),
                  key: "prefix",
                },
                {
                  cell: (apiKey) =>
                    apiKey.revokedAt
                      ? t("apiKeys.revoked")
                      : t("apiKeys.active"),
                  header: t("apiKeys.status"),
                  key: "status",
                },
                {
                  cell: (apiKey) =>
                    apiKey.revokedAt ? null : (
                      <form action={revokeTenantApiKeyAction}>
                        <input
                          name="apiKeyId"
                          type="hidden"
                          value={apiKey.id}
                        />
                        <input
                          name="locale"
                          type="hidden"
                          value={resolvedLocale}
                        />
                        <Button size="sm" type="submit" variant="destructive">
                          {t("apiKeys.revoke")}
                        </Button>
                      </form>
                    ),
                  header: t("apiKeys.action"),
                  key: "action",
                },
              ]}
              data={apiKeys}
              emptyLabel={t("apiKeys.empty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon aria-hidden="true" className="size-5" />
              {t("controls.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form action={updateQuotaAction} className="grid gap-4">
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Field label={t("controls.storageQuota")}>
                <TextInput
                  defaultValue={quota?.storageBytesLimit}
                  disabled={!canManageLimits}
                  min={0}
                  name="storageBytesLimit"
                  type="number"
                />
              </Field>
              <Field label={t("controls.aiLimit")}>
                <TextInput
                  defaultValue={quota?.aiTokenLimit}
                  disabled={!canManageLimits}
                  min={0}
                  name="aiTokenLimit"
                  type="number"
                />
              </Field>
              <Button disabled={!canManageLimits} type="submit">
                {t("controls.saveQuota")}
              </Button>
            </form>
            <div className="grid gap-3">
              {usageLimits.map((limit) => (
                <form
                  action={updateUsageLimitAction}
                  className="grid gap-3 rounded-md border p-3"
                  key={limit.key}
                >
                  <input name="locale" type="hidden" value={resolvedLocale} />
                  <input name="key" type="hidden" value={limit.key} />
                  <p className="text-sm font-medium">{limit.key}</p>
                  <Field label={t("controls.limitValue")}>
                    <TextInput
                      defaultValue={limit.limitValue}
                      disabled={!canManageLimits}
                      min={0}
                      name="limitValue"
                      type="number"
                    />
                  </Field>
                  <Field label={t("controls.windowSeconds")}>
                    <TextInput
                      defaultValue={limit.windowSeconds}
                      disabled={!canManageLimits}
                      min={0}
                      name="windowSeconds"
                      type="number"
                    />
                  </Field>
                  <Button
                    disabled={!canManageLimits}
                    size="sm"
                    type="submit"
                    variant="outline"
                  >
                    {t("controls.saveLimit")}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("flags.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {featureFlags.map((flag) => (
              <form
                action={updateFeatureFlagAction}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                key={flag.key}
              >
                <input name="locale" type="hidden" value={resolvedLocale} />
                <input name="key" type="hidden" value={flag.key} />
                <div>
                  <p className="text-sm font-medium">{flag.key}</p>
                  <p className="text-muted-foreground text-xs">
                    {flag.enabled ? t("enabled") : t("disabled")}
                  </p>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    defaultChecked={flag.enabled}
                    disabled={!canManageFlags}
                    name="enabled"
                    type="checkbox"
                  />
                  {t("flags.enabled")}
                </label>
                <Button
                  disabled={!canManageFlags}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  {t("flags.save")}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("audit.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (event) => event.eventType,
                  header: t("audit.event"),
                  key: "event",
                },
                {
                  cell: (event) =>
                    dateTimeFormatter.format(new Date(event.createdAt)),
                  header: t("audit.created"),
                  key: "created",
                },
              ]}
              data={auditEvents}
              emptyLabel={t("audit.empty")}
            />
          </CardContent>
        </Card>
      </section>
      <p className="text-muted-foreground text-xs">
        {t("controls.currentUsage", {
          ai: numberFormatter.format(quota?.aiTokenUsed ?? 0),
          storage: numberFormatter.format(quota?.storageBytesUsed ?? 0),
        })}
      </p>
    </div>
  );
}
