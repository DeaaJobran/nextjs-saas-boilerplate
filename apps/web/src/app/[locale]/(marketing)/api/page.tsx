import { apiRouteCatalog, apiScopeCatalog } from "@nextjs-saas/api/contracts";
import { appConfig } from "@nextjs-saas/config/app";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { assertLocale } from "../../../../lib/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const t = await getTranslations({ locale, namespace: "ApiDocsPage" });

  return {
    description: t("description"),
    title: `${t("title")} | ${appConfig.name}`,
  };
}

function methodVariant(method: string) {
  if (method === "GET") {
    return "secondary" as const;
  }

  if (method === "DELETE") {
    return "warning" as const;
  }

  return "default" as const;
}

export default async function ApiDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const t = await getTranslations({ locale, namespace: "ApiDocsPage" });
  const version = process.env.npm_package_version ?? "0.3.0";
  const routeGroups = apiRouteCatalog.reduce(
    (groups, route) => {
      for (const tag of route.tags) {
        groups[tag] ??= [];
        groups[tag].push(route);
      }

      return groups;
    },
    {} as Record<string, (typeof apiRouteCatalog)[number][]>,
  );
  const openApiPath =
    apiRouteCatalog.find((route) => route.id === "getOpenApi")?.path ??
    "/api/v1/openapi.json";
  const sdkPath =
    apiRouteCatalog.find((route) => route.id === "getTypeScriptSdk")?.path ??
    "/api/v1/sdk/typescript";

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-primary text-sm font-medium">{t("eyebrow")}</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-lg leading-8">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={openApiPath}>{t("copyOpenApi")}</a>
            </Button>
            <Button asChild variant="outline">
              <a href={sdkPath}>{t("copySdk")}</a>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("generatedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-muted-foreground text-sm leading-6">
              {t("generatedDescription")}
            </p>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("versionLabel")}
                </span>
                <Badge variant="outline">{t("version", { version })}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("endpointCount", { count: apiRouteCatalog.length })}
                </span>
                <Badge variant="secondary">REST</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="grid gap-4">
          {Object.entries(routeGroups).map(([tag, routes]) => (
            <Card key={tag}>
              <CardHeader>
                <CardTitle>{tag}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {routes.map((route) => (
                  <div
                    className="grid min-w-0 gap-3 rounded-md border p-3 sm:grid-cols-[5rem_minmax(0,1fr)]"
                    key={route.id}
                  >
                    <div>
                      <Badge variant={methodVariant(route.method)}>
                        {route.method}
                      </Badge>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="bg-muted min-w-0 rounded px-2 py-1 text-sm break-all">
                          {route.path}
                        </code>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{route.summary}</p>
                        <p className="text-muted-foreground text-sm leading-6">
                          {route.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {route.requiredScopes.length > 0 ? (
                          route.requiredScopes.map((scope) => (
                            <Badge key={scope} variant="outline">
                              {scope}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">{t("publicAccess")}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <aside className="grid h-fit gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("authTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-6">
                {t("authDescription")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("scopesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-muted-foreground text-sm leading-6">
                {t("scopesDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                {apiScopeCatalog.map((scope) => (
                  <Badge key={scope} variant="outline">
                    {scope}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
