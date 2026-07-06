import { appConfig } from "@nextjs-saas/config/app";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nextjs-saas/ui";

export default function DocsHome() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <section className="space-y-4">
        <Badge variant="outline">Docs app</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          {appConfig.name} documentation
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          This app is the public documentation target. Implementation guides,
          module references, and upgrade notes will live here as tracked docs.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {["Setup", "Architecture", "Upgrade notes"].map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Section shell ready for documentation content.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
