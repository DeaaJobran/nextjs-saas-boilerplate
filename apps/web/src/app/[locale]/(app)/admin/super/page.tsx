import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Textarea,
} from "@nextjs-saas/ui";
import { ShieldAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { requireAdminSession } from "../../../../../lib/admin-auth";
import { assertLocale } from "../../../../../lib/locale";
import {
  formatLocaleDateTime,
  formatLocaleNumber,
} from "../../../../../lib/locale-formatters";
import { getTenantService } from "../../../../../lib/tenant";
import { startImpersonationAction } from "../../tenant-actions";

type SuperAdminSearchParams = {
  status?: string;
};

function statusMessage(
  status: string | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (status === "impersonation-ended") {
    return t("status.impersonationEnded");
  }

  if (status === "impersonation-started") {
    return t("status.impersonationStarted");
  }

  if (status === "invalid-impersonation-target") {
    return t("status.invalidImpersonationTarget");
  }

  return status ? t("status.generic") : undefined;
}

export default async function SuperAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SuperAdminSearchParams>;
}) {
  const fallbackSearchParams: Promise<SuperAdminSearchParams> = Promise.resolve(
    {},
  );
  const [{ locale }, query, t, session] = await Promise.all([
    params,
    searchParams ?? fallbackSearchParams,
    getTranslations("SuperAdmin"),
    requireAdminSession(),
  ]);
  const resolvedLocale = assertLocale(locale);
  const summary = await getTenantService().getSuperAdminSummary({
    actorGlobalRole: session.user.role,
    actorId: session.user.id,
  });
  const message = statusMessage(query.status, t);

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
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [t("cards.organizations"), summary.organizations.length],
          [t("cards.members"), summary.members.length],
          [t("cards.impersonations"), summary.activeImpersonations.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatLocaleNumber(resolvedLocale, Number(value))}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlertIcon aria-hidden="true" className="size-5" />
            {t("impersonation.title")}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("impersonation.description")}
          </p>
        </CardHeader>
        <CardContent>
          <form action={startImpersonationAction} className="grid gap-4">
            <input name="locale" type="hidden" value={resolvedLocale} />
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="impersonation-target"
              >
                {t("impersonation.member")}
                <span aria-hidden="true"> *</span>
              </label>
              <select
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-11 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={summary.members.length === 0}
                id="impersonation-target"
                name="target"
                required
              >
                {summary.members.map((member) => (
                  <option
                    key={`${member.organizationId}-${member.userId}`}
                    value={JSON.stringify({
                      organizationId: member.organizationId,
                      subjectUserId: member.userId,
                    })}
                  >
                    {member.organizationName} / {member.displayName} /{" "}
                    {member.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="impersonation-reason"
              >
                {t("impersonation.reason")}
                <span aria-hidden="true"> *</span>
              </label>
              <Textarea id="impersonation-reason" name="reason" required />
            </div>
            <Button
              disabled={summary.members.length === 0}
              type="submit"
              variant="destructive"
            >
              {t("impersonation.start")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("organizations.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (organization) => organization.name,
                  header: t("organizations.name"),
                  key: "name",
                },
                {
                  cell: (organization) => organization.slug,
                  header: t("organizations.slug"),
                  key: "slug",
                },
                {
                  cell: (organization) => organization.memberCount,
                  header: t("organizations.members"),
                  key: "members",
                },
              ]}
              data={summary.organizations}
              emptyLabel={t("organizations.empty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("members.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (member) => member.organizationName,
                  header: t("members.organization"),
                  key: "organization",
                },
                {
                  cell: (member) => member.email,
                  header: t("members.email"),
                  key: "email",
                },
                {
                  cell: (member) => (
                    <Badge variant="outline">{member.role}</Badge>
                  ),
                  header: t("members.role"),
                  key: "role",
                },
              ]}
              data={summary.members}
              emptyLabel={t("members.empty")}
            />
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("activeImpersonations.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (impersonation) => impersonation.actorEmail,
                  header: t("activeImpersonations.actor"),
                  key: "actor",
                },
                {
                  cell: (impersonation) => impersonation.subjectEmail,
                  header: t("activeImpersonations.subject"),
                  key: "subject",
                },
                {
                  cell: (impersonation) => impersonation.reason,
                  header: t("activeImpersonations.reason"),
                  key: "reason",
                },
              ]}
              data={summary.activeImpersonations}
              emptyLabel={t("activeImpersonations.empty")}
            />
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
                    formatLocaleDateTime(resolvedLocale, event.createdAt),
                  header: t("audit.created"),
                  key: "created",
                },
              ]}
              data={summary.auditEvents}
              emptyLabel={t("audit.empty")}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
