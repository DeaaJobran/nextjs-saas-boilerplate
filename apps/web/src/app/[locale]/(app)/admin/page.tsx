import { createContentRepository } from "@nextjs-saas/config/content";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";

export default function AdminPage() {
  const pages = createContentRepository().listPages("en");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Managed pages", String(pages.length), "published content records"],
        ["Locales", "2", "English and Arabic configured"],
        ["Publish states", "4", "draft, scheduled, published, archived"],
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
