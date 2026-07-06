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

const emptySubmissions = (
  <p className="text-muted-foreground rounded-md border p-4 text-sm">
    No contact submissions yet.
  </p>
);

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
  const repository = await getContentRepository();
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
          Content changes saved and public routes revalidated.
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Managed content registry</CardTitle>
          <CardDescription>
            Landing, pricing, contact, and legal pages are read from editable
            content records rather than static page copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "title", header: "Title", cell: (row) => row.title },
              { key: "kind", header: "Type", cell: (row) => row.kind },
              { key: "locale", header: "Locale", cell: (row) => row.locale },
              {
                key: "state",
                header: "Publish state",
                cell: (row) => (
                  <Badge variant={stateVariant(row.publishState)}>
                    {row.publishState}
                  </Badge>
                ),
              },
              {
                key: "action",
                header: "Action",
                cell: (row) => (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/content?selected=${row.id}`}>Edit</Link>
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
          <CardTitle>Recent contact submissions</CardTitle>
          <CardDescription>
            Messages submitted through the public contact form are stored in the
            active content store for admin review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            empty={emptySubmissions}
            columns={[
              { key: "name", header: "Name", cell: (row) => row.name },
              { key: "email", header: "Email", cell: (row) => row.email },
              { key: "locale", header: "Locale", cell: (row) => row.locale },
              {
                key: "submittedAt",
                header: "Submitted",
                cell: (row) => new Date(row.submittedAt).toLocaleString(),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => <Badge variant="outline">{row.status}</Badge>,
              },
            ]}
            data={submissions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
