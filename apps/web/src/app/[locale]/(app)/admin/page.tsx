import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";

import { getContentRepository } from "../../../../lib/content-store";

export default async function AdminPage() {
  const repository = await getContentRepository();
  const pages = repository.listAllPages();
  const submissions = repository.listContactSubmissions();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Managed pages", String(pages.length), "editable content records"],
        ["Locales", "2", "English and Arabic configured"],
        [
          "Contact messages",
          String(submissions.length),
          "saved through the managed contact form",
        ],
      ].map(([title, value, description]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              {title}
              <Badge variant="outline">Admin</Badge>
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
