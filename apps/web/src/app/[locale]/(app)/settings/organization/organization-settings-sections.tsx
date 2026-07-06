import { type Locale, localeLabels } from "@nextjs-saas/localization";
import {
  tenantApiKeyScopeCatalog,
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
  SelectInput,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { KeyRoundIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import type { getTranslations } from "next-intl/server";

import {
  formatLocaleDateTime,
  formatLocaleNumber,
} from "../../../../../lib/locale-formatters";
import type {
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

type OrganizationSettingsTranslations = Awaited<
  ReturnType<typeof getTranslations>
>;
type TenantContext = Awaited<ReturnType<typeof getActiveTenantContext>>;
type TenantService = ReturnType<typeof getTenantService>;
type TenantMembers = Awaited<ReturnType<TenantService["listMembers"]>>;
type TenantInvitations = Awaited<ReturnType<TenantService["listInvitations"]>>;
type TenantFeatureFlags = Awaited<
  ReturnType<TenantService["listFeatureFlags"]>
>;
type TenantUsageLimits = Awaited<ReturnType<TenantService["listUsageLimits"]>>;
type TenantQuota = Awaited<ReturnType<TenantService["getQuota"]>>;
type TenantApiKeys = Awaited<ReturnType<TenantService["listTenantApiKeys"]>>;
type TenantAuditEvents = Awaited<ReturnType<TenantService["listAuditEvents"]>>;

type OrganizationSettingsCapabilities = {
  canInvite: boolean;
  canManageFlags: boolean;
  canManageKeys: boolean;
  canManageLimits: boolean;
  canRejectInvitations: boolean;
  canRemoveMembers: boolean;
  canUpdateMembers: boolean;
  canUpdateOrganization: boolean;
};

type OrganizationSettingsContentProps = {
  apiKeys: TenantApiKeys;
  auditEvents: TenantAuditEvents;
  capabilities: OrganizationSettingsCapabilities;
  context: TenantContext;
  enabledLocales: Locale[];
  featureFlags: TenantFeatureFlags;
  invitations: TenantInvitations;
  members: TenantMembers;
  message?: string;
  quota: TenantQuota;
  resolvedLocale: Locale;
  shouldLoadApiKeySecret: boolean;
  t: OrganizationSettingsTranslations;
  usageLimits: TenantUsageLimits;
};

export function OrganizationSettingsContent({
  apiKeys,
  auditEvents,
  capabilities,
  context,
  enabledLocales,
  featureFlags,
  invitations,
  members,
  message,
  quota,
  resolvedLocale,
  shouldLoadApiKeySecret,
  t,
  usageLimits,
}: OrganizationSettingsContentProps) {
  const {
    canInvite,
    canManageFlags,
    canManageKeys,
    canManageLimits,
    canRejectInvitations,
    canRemoveMembers,
    canUpdateMembers,
    canUpdateOrganization,
  } = capabilities;

  return (
    <div className="grid gap-6">
      <StatusBanner message={message} />
      <ApiKeySecretNotice
        description={t("apiKeys.secretDescription")}
        enabled={shouldLoadApiKeySecret}
        loadingLabel={t("apiKeys.secretLoading")}
        revealLabel={t("apiKeys.secretReveal")}
        title={t("apiKeys.secretTitle")}
        unavailableLabel={t("apiKeys.secretUnavailable")}
      />
      <ProfileAndPermissionsSection
        canUpdateOrganization={canUpdateOrganization}
        context={context}
        enabledLocales={enabledLocales}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <InvitationsSection
        canInvite={canInvite}
        canRejectInvitations={canRejectInvitations}
        invitations={invitations}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <MembersCard
        canRemoveMembers={canRemoveMembers}
        canUpdateMembers={canUpdateMembers}
        members={members}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <ApiKeysAndControlsSection
        apiKeys={apiKeys}
        canManageKeys={canManageKeys}
        canManageLimits={canManageLimits}
        quota={quota}
        resolvedLocale={resolvedLocale}
        t={t}
        usageLimits={usageLimits}
      />
      <FlagsAndAuditSection
        auditEvents={auditEvents}
        canManageFlags={canManageFlags}
        featureFlags={featureFlags}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <CurrentUsageSummary
        quota={quota}
        resolvedLocale={resolvedLocale}
        t={t}
      />
    </div>
  );
}

function StatusBanner({ message }: { message?: string }) {
  return message ? (
    <p
      className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
      role="status"
    >
      {message}
    </p>
  ) : null;
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
    <SelectInput
      aria-label={ariaLabel}
      className="text-sm"
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
    </SelectInput>
  );
}

function permissionsText(permissions: readonly string[] | null | undefined) {
  return permissions?.join("\n") ?? "";
}

function ProfileAndPermissionsSection({
  canUpdateOrganization,
  context,
  enabledLocales,
  resolvedLocale,
  t,
}: {
  canUpdateOrganization: boolean;
  context: TenantContext;
  enabledLocales: Locale[];
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <OrganizationProfileCard
        canUpdateOrganization={canUpdateOrganization}
        context={context}
        enabledLocales={enabledLocales}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <PermissionSummaryCard context={context} t={t} />
    </section>
  );
}

function OrganizationProfileCard({
  canUpdateOrganization,
  context,
  enabledLocales,
  resolvedLocale,
  t,
}: {
  canUpdateOrganization: boolean;
  context: TenantContext;
  enabledLocales: Locale[];
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
              defaultValue={context.organization.description ?? undefined}
              disabled={!canUpdateOrganization}
              name="description"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("profile.website")}>
              <TextInput
                defaultValue={context.organization.websiteUrl ?? undefined}
                disabled={!canUpdateOrganization}
                name="websiteUrl"
                type="url"
              />
            </Field>
            <Field label={t("profile.logo")}>
              <TextInput
                defaultValue={context.organization.logoUrl ?? undefined}
                disabled={!canUpdateOrganization}
                name="logoUrl"
                type="url"
              />
            </Field>
          </div>
          <Field label={t("profile.locale")}>
            <SelectInput
              defaultValue={context.organization.defaultLocale}
              disabled={!canUpdateOrganization}
              name="defaultLocale"
            >
              {enabledLocales.map((availableLocale) => (
                <option key={availableLocale} value={availableLocale}>
                  {localeLabels[availableLocale]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button disabled={!canUpdateOrganization} type="submit">
            {t("profile.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PermissionSummaryCard({
  context,
  t,
}: {
  context: TenantContext;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
  );
}

function InvitationsSection({
  canInvite,
  canRejectInvitations,
  invitations,
  resolvedLocale,
  t,
}: {
  canInvite: boolean;
  canRejectInvitations: boolean;
  invitations: TenantInvitations;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <InviteMemberCard
        canInvite={canInvite}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <InvitationsCard
        canRejectInvitations={canRejectInvitations}
        invitations={invitations}
        resolvedLocale={resolvedLocale}
        t={t}
      />
    </section>
  );
}

function InviteMemberCard({
  canInvite,
  resolvedLocale,
  t,
}: {
  canInvite: boolean;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
  );
}

function InvitationsCard({
  canRejectInvitations,
  invitations,
  resolvedLocale,
  t,
}: {
  canRejectInvitations: boolean;
  invitations: TenantInvitations;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
                    <input name="locale" type="hidden" value={resolvedLocale} />
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
  );
}

function MembersCard({
  canRemoveMembers,
  canUpdateMembers,
  members,
  resolvedLocale,
  t,
}: {
  canRemoveMembers: boolean;
  canUpdateMembers: boolean;
  members: TenantMembers;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
                <MemberRoleForm
                  canUpdateMembers={canUpdateMembers}
                  member={member}
                  resolvedLocale={resolvedLocale}
                  t={t}
                />
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
                    disabled={!canRemoveMembers}
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
  );
}

function MemberRoleForm({
  canUpdateMembers,
  member,
  resolvedLocale,
  t,
}: {
  canUpdateMembers: boolean;
  member: TenantMembers[number];
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
  );
}

function ApiKeysAndControlsSection({
  apiKeys,
  canManageKeys,
  canManageLimits,
  quota,
  resolvedLocale,
  t,
  usageLimits,
}: {
  apiKeys: TenantApiKeys;
  canManageKeys: boolean;
  canManageLimits: boolean;
  quota: TenantQuota;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
  usageLimits: TenantUsageLimits;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <ApiKeysCard
        apiKeys={apiKeys}
        canManageKeys={canManageKeys}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <TenantControlsCard
        canManageLimits={canManageLimits}
        quota={quota}
        resolvedLocale={resolvedLocale}
        t={t}
        usageLimits={usageLimits}
      />
    </section>
  );
}

function ApiKeysCard({
  apiKeys,
  canManageKeys,
  resolvedLocale,
  t,
}: {
  apiKeys: TenantApiKeys;
  canManageKeys: boolean;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon aria-hidden="true" className="size-5" />
          {t("apiKeys.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <CreateApiKeyForm
          canManageKeys={canManageKeys}
          resolvedLocale={resolvedLocale}
          t={t}
        />
        <ApiKeyTable apiKeys={apiKeys} resolvedLocale={resolvedLocale} t={t} />
      </CardContent>
    </Card>
  );
}

function CreateApiKeyForm({
  canManageKeys,
  resolvedLocale,
  t,
}: {
  canManageKeys: boolean;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <form
      action={createTenantApiKeyAction}
      aria-label={t("apiKeys.create")}
      className="grid gap-4"
    >
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
  );
}

function ApiKeyTable({
  apiKeys,
  resolvedLocale,
  t,
}: {
  apiKeys: TenantApiKeys;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
            apiKey.revokedAt ? t("apiKeys.revoked") : t("apiKeys.active"),
          header: t("apiKeys.status"),
          key: "status",
        },
        {
          cell: (apiKey) =>
            apiKey.revokedAt ? null : (
              <form action={revokeTenantApiKeyAction}>
                <input name="apiKeyId" type="hidden" value={apiKey.id} />
                <input name="locale" type="hidden" value={resolvedLocale} />
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
  );
}

function TenantControlsCard({
  canManageLimits,
  quota,
  resolvedLocale,
  t,
  usageLimits,
}: {
  canManageLimits: boolean;
  quota: TenantQuota;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
  usageLimits: TenantUsageLimits;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon aria-hidden="true" className="size-5" />
          {t("controls.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <QuotaForm
          canManageLimits={canManageLimits}
          quota={quota}
          resolvedLocale={resolvedLocale}
          t={t}
        />
        <UsageLimitForms
          canManageLimits={canManageLimits}
          resolvedLocale={resolvedLocale}
          t={t}
          usageLimits={usageLimits}
        />
      </CardContent>
    </Card>
  );
}

function QuotaForm({
  canManageLimits,
  quota,
  resolvedLocale,
  t,
}: {
  canManageLimits: boolean;
  quota: TenantQuota;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <form action={updateQuotaAction} className="grid gap-4">
      <input name="locale" type="hidden" value={resolvedLocale} />
      <Field label={t("controls.storageQuota")}>
        <TextInput
          defaultValue={quota?.storageBytesLimit ?? undefined}
          disabled={!canManageLimits}
          min={0}
          name="storageBytesLimit"
          type="number"
        />
      </Field>
      <Field label={t("controls.aiLimit")}>
        <TextInput
          defaultValue={quota?.aiTokenLimit ?? undefined}
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
  );
}

function UsageLimitForms({
  canManageLimits,
  resolvedLocale,
  t,
  usageLimits,
}: {
  canManageLimits: boolean;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
  usageLimits: TenantUsageLimits;
}) {
  return (
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
  );
}

function FlagsAndAuditSection({
  auditEvents,
  canManageFlags,
  featureFlags,
  resolvedLocale,
  t,
}: {
  auditEvents: TenantAuditEvents;
  canManageFlags: boolean;
  featureFlags: TenantFeatureFlags;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <FeatureFlagsCard
        canManageFlags={canManageFlags}
        featureFlags={featureFlags}
        resolvedLocale={resolvedLocale}
        t={t}
      />
      <AuditLogCard
        auditEvents={auditEvents}
        resolvedLocale={resolvedLocale}
        t={t}
      />
    </section>
  );
}

function FeatureFlagsCard({
  canManageFlags,
  featureFlags,
  resolvedLocale,
  t,
}: {
  canManageFlags: boolean;
  featureFlags: TenantFeatureFlags;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
  );
}

function AuditLogCard({
  auditEvents,
  resolvedLocale,
  t,
}: {
  auditEvents: TenantAuditEvents;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
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
                formatLocaleDateTime(resolvedLocale, event.createdAt),
              header: t("audit.created"),
              key: "created",
            },
          ]}
          data={auditEvents}
          emptyLabel={t("audit.empty")}
        />
      </CardContent>
    </Card>
  );
}

function CurrentUsageSummary({
  quota,
  resolvedLocale,
  t,
}: {
  quota: TenantQuota;
  resolvedLocale: Locale;
  t: OrganizationSettingsTranslations;
}) {
  return (
    <p className="text-muted-foreground text-xs">
      {t("controls.currentUsage", {
        ai: formatLocaleNumber(resolvedLocale, quota?.aiTokenUsed ?? 0),
        storage: formatLocaleNumber(
          resolvedLocale,
          quota?.storageBytesUsed ?? 0,
        ),
      })}
    </p>
  );
}
