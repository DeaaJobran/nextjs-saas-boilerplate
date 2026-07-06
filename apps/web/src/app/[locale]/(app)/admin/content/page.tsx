import { createContentRepository } from "@nextjs-saas/config/content";
import { locales } from "@nextjs-saas/localization";
import { Badge, DataTable } from "@nextjs-saas/ui";

export default function AdminContentPage() {
  // TODO: Add auth-protected create, update, publish, and audit workflows once the identity and database modules exist.
  const repository = createContentRepository();
  const pages = locales.flatMap((locale) => repository.listPages(locale));

  return (
    <DataTable
      columns={[
        { key: "title", header: "Title", cell: (row) => row.title },
        { key: "kind", header: "Type", cell: (row) => row.kind },
        { key: "locale", header: "Locale", cell: (row) => row.locale },
        {
          key: "state",
          header: "Publish state",
          cell: (row) => <Badge variant="success">{row.publishState}</Badge>,
        },
      ]}
      data={pages}
    />
  );
}
