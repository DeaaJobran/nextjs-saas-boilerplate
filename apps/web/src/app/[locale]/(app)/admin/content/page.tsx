import type { PublishState } from "@nextjs-saas/config/content";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import {
  ContactSettingsEditor,
  CreateManagedPageForm,
  ManagedPageEditor,
  PricingPlansEditor,
} from "../../../../../components/admin-content-editor";
import { Link } from "../../../../../i18n/navigation";
import { getContentRepository } from "../../../../../lib/content-store";
import { assertLocale } from "../../../../../lib/locale";
import {
  createManagedPageAction,
  saveContactSettingsAction,
  saveManagedPageAction,
  savePricingPlansAction,
} from "./actions";

function stateVariant(
  state: PublishState,
): "outline" | "secondary" | "success" | "warning" {
  const variants = {
    archived: "secondary",
    draft: "outline",
    published: "success",
    scheduled: "warning",
  } satisfies Record<
    PublishState,
    "outline" | "secondary" | "success" | "warning"
  >;

  return variants[state];
}

export default async function AdminContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; selected?: string }>;
}) {
  const [{ locale: localeValue }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const adminLocale = assertLocale(localeValue);
  const [t, kindT, stateT, submissionStatusT, repository] = await Promise.all([
    getTranslations({
      locale: adminLocale,
      namespace: "AdminContent",
    }),
    getTranslations({
      locale: adminLocale,
      namespace: "PageKind",
    }),
    getTranslations({
      locale: adminLocale,
      namespace: "PublicationState",
    }),
    getTranslations({
      locale: adminLocale,
      namespace: "ContactSubmissionStatus",
    }),
    getContentRepository(),
  ]);
  const pages = repository.listAllPages();
  const selectedPage =
    repository.getPageById(query.selected ?? "") ??
    repository.getPageById(`landing-${adminLocale}`) ??
    pages[0];
  const contactLocale = selectedPage?.locale ?? adminLocale;
  const contactFields = repository.listContactFields(contactLocale);
  const contactRouting = repository.getContactRouting(contactLocale);
  const pricingPlans = repository.listPricingPlans(contactLocale);
  const submissions = repository.listContactSubmissions().slice(0, 5);

  if (!selectedPage) {
    return null;
  }

  return (
    <div className="grid gap-6">
      {query.saved ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50"
          role="status"
        >
          {t("contentChangesSaved")}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: "title",
                header: t("pageTitle"),
                cell: (row) => row.title,
              },
              {
                key: "kind",
                header: t("type"),
                cell: (row) => kindT(row.kind),
              },
              { key: "locale", header: t("locale"), cell: (row) => row.locale },
              {
                key: "state",
                header: t("publishState"),
                cell: (row) => (
                  <Badge variant={stateVariant(row.publishState)}>
                    {stateT(row.publishState)}
                  </Badge>
                ),
              },
              {
                key: "action",
                header: t("action"),
                cell: (row) => (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/content?selected=${row.id}`}>
                      {t("edit")}
                    </Link>
                  </Button>
                ),
              },
            ]}
            data={pages}
          />
        </CardContent>
      </Card>
      <ManagedPageEditor
        action={saveManagedPageAction}
        adminLocale={adminLocale}
        key={selectedPage.id}
        page={selectedPage}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <CreateManagedPageForm
          action={createManagedPageAction}
          adminLocale={adminLocale}
        />
        <PricingPlansEditor
          action={savePricingPlansAction}
          adminLocale={adminLocale}
          key={`pricing-${contactLocale}`}
          locale={contactLocale}
          plans={pricingPlans}
        />
        <ContactSettingsEditor
          action={saveContactSettingsAction}
          adminLocale={adminLocale}
          fields={contactFields}
          key={`contact-${contactLocale}`}
          locale={contactLocale}
          routing={contactRouting}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recentSubmissionsTitle")}</CardTitle>
          <CardDescription>{t("recentSubmissionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            emptyLabel={t("emptySubmissions")}
            columns={[
              { key: "name", header: t("name"), cell: (row) => row.name },
              { key: "email", header: t("email"), cell: (row) => row.email },
              { key: "locale", header: t("locale"), cell: (row) => row.locale },
              {
                key: "submittedAt",
                header: t("submitted"),
                cell: (row) => new Date(row.submittedAt).toLocaleString(),
              },
              {
                key: "status",
                header: t("status"),
                cell: (row) => (
                  <Badge variant="outline">
                    {submissionStatusT(row.status)}
                  </Badge>
                ),
              },
            ]}
            data={submissions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
