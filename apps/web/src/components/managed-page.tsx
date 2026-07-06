import type { ManagedPage } from "@nextjs-saas/config/content";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";

import { Link } from "../i18n/navigation";

export function ManagedPageSections({ page }: { page: ManagedPage }) {
  return (
    <div className="grid gap-6">
      {page.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            {section.eyebrow ? (
              <p className="text-primary text-sm font-medium">
                {section.eyebrow}
              </p>
            ) : null}
            <CardTitle className="text-2xl leading-tight">
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-muted-foreground">{section.body}</p>
            {section.items ? (
              <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-3">
                {section.items.map((item) => (
                  <li className="bg-muted/40 rounded-md border p-3" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.cta ? (
              <Button asChild className="w-fit">
                <Link href={section.cta.href}>{section.cta.label}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
