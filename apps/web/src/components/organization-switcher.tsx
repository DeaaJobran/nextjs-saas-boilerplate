import type { Organization } from "@nextjs-saas/tenant";
import { Button, SelectInput } from "@nextjs-saas/ui";
import { Building2Icon, ShieldAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  endImpersonationAction,
  switchOrganizationAction,
} from "../app/[locale]/(app)/tenant-actions";

export async function OrganizationSwitcher({
  activeOrganization,
  impersonationSessionId,
  locale,
  organizations,
}: {
  activeOrganization: Organization;
  impersonationSessionId?: string;
  locale: string;
  organizations: Organization[];
}) {
  const t = await getTranslations({ locale, namespace: "Organization" });

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <form action={switchOrganizationAction} className="flex min-w-0 gap-2">
        <input name="locale" type="hidden" value={locale} />
        <label className="sr-only" htmlFor="organizationId">
          {t("switcherLabel")}
        </label>
        <div className="relative min-w-0">
          <Building2Icon
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <SelectInput
            className="h-10 max-w-52 py-2 ps-9 pe-3 text-sm"
            defaultValue={activeOrganization.id}
            disabled={Boolean(impersonationSessionId)}
            id="organizationId"
            name="organizationId"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </SelectInput>
        </div>
        <Button
          disabled={Boolean(impersonationSessionId)}
          type="submit"
          variant="outline"
        >
          {t("switch")}
        </Button>
      </form>
      {impersonationSessionId ? (
        <form action={endImpersonationAction}>
          <input
            name="impersonationSessionId"
            type="hidden"
            value={impersonationSessionId}
          />
          <input name="locale" type="hidden" value={locale} />
          <Button type="submit" variant="destructive">
            <ShieldAlertIcon aria-hidden="true" className="size-4" />
            {t("endImpersonation")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
