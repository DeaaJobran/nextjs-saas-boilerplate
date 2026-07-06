import { type AuthRole, authRoleConfig } from "@nextjs-saas/auth";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  SelectInput,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { requireAdminSession } from "../../../../../lib/admin-auth";
import { getAuthService } from "../../../../../lib/auth";
import {
  createAdminManagedUserAction,
  createInvitationAction,
} from "./actions";

type AdminUsersSearchParams = {
  status?: string;
};

function RoleSelect({ roles }: { roles: readonly AuthRole[] }) {
  return (
    <SelectInput
      className="h-10 text-sm"
      defaultValue={authRoleConfig.defaultAdminManagedRole}
      name="role"
      required
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </SelectInput>
  );
}

export default async function AdminUsersPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminUsersSearchParams>;
}) {
  const paramsPromise: Promise<AdminUsersSearchParams> =
    searchParams ?? Promise.resolve({});
  const usersPromise = requireAdminSession().then(() =>
    getAuthService().listUsers(),
  );

  const [t, { locale }, params, users] = await Promise.all([
    getTranslations("AdminUsers"),
    routeParams,
    paramsPromise,
    usersPromise,
  ]);

  return (
    <div className="grid gap-6">
      {params.status ? (
        <p
          className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
          role="status"
        >
          {params.status === "user-created"
            ? t("status.userCreated")
            : params.status === "invitation-created"
              ? t("status.invitationCreated")
              : params.status === "invalid-role"
                ? t("status.invalidRole")
                : t("status.generic")}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("createUserTitle")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("createUserDescription")}
            </p>
          </CardHeader>
          <CardContent>
            <form action={createAdminManagedUserAction} className="grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <Field label={t("displayName")} required>
                <TextInput name="displayName" required />
              </Field>
              <Field label={t("email")} required>
                <TextInput name="email" required type="email" />
              </Field>
              <Field label={t("role")} required>
                <RoleSelect roles={authRoleConfig.assignableRoles} />
              </Field>
              <Button type="submit">{t("createUser")}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("inviteTitle")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("inviteDescription")}
            </p>
          </CardHeader>
          <CardContent>
            <form action={createInvitationAction} className="grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <Field label={t("email")} required>
                <TextInput name="email" required type="email" />
              </Field>
              <Field label={t("role")} required>
                <RoleSelect roles={authRoleConfig.assignableRoles} />
              </Field>
              <Button type="submit" variant="outline">
                {t("sendInvitation")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("usersTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("usersDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (user) => user.displayName,
                header: t("table.name"),
                key: "name",
              },
              {
                cell: (user) => user.email,
                header: t("table.email"),
                key: "email",
              },
              {
                cell: (user) => <Badge variant="outline">{user.role}</Badge>,
                header: t("table.role"),
                key: "role",
              },
              {
                cell: (user) =>
                  user.emailVerifiedAt ? t("verified") : t("unverified"),
                header: t("table.emailStatus"),
                key: "emailStatus",
              },
            ]}
            data={users}
            emptyLabel={t("emptyUsers")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
