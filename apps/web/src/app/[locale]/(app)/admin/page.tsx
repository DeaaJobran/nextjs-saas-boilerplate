import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { requireAdminSession } from "../../../../lib/admin-auth";
import { getContentRepository } from "../../../../lib/content-store";
import { getTenantService } from "../../../../lib/tenant";

export default async function AdminPage() {
  const [t, session, repository] = await Promise.all([
    getTranslations("AdminOverview"),
    requireAdminSession(),
    getContentRepository(),
  ]);
  const pages = repository.listAllPages();
  const submissions = repository.listContactSubmissions();
  const tenantSummary = await getTenantService().getSuperAdminSummary({
    actorGlobalRole: session.user.role,
    actorId: session.user.id,
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        [t("managedPages"), String(pages.length), t("managedPagesDescription")],
        [t("locales"), "2", t("localeDescription")],
        [
          t("contactMessages"),
          String(submissions.length),
          t("contactDescription"),
        ],
        [
          t("organizations"),
          String(tenantSummary.organizations.length),
          t("organizationsDescription"),
        ],
        [
          t("tenantMembers"),
          String(tenantSummary.members.length),
          t("tenantMembersDescription"),
        ],
        [
          t("impersonations"),
          String(tenantSummary.activeImpersonations.length),
          t("impersonationsDescription"),
        ],
      ].map(([title, value, description]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              {title}
              <Badge variant="outline">{t("adminBadge")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{value}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
