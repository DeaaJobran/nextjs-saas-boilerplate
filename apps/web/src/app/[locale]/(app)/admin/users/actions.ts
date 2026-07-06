"use server";

import { type AuthRole, isAuthRole } from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../../../../../lib/admin-auth";
import { getAuthService } from "../../../../../lib/auth";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function localizedAdminUsersPath(formData: FormData) {
  const locale = formValue(formData, "locale");

  return locale ? `/${locale}${appRoutes.adminUsers}` : appRoutes.adminUsers;
}

function roleFromForm(formData: FormData): AuthRole {
  const role = formValue(formData, "role");

  if (!isAuthRole(role)) {
    redirect(`${localizedAdminUsersPath(formData)}?status=invalid-role`);
  }

  return role;
}

export async function createAdminManagedUserAction(formData: FormData) {
  const session = await requireAdminSession();

  await getAuthService().createUserByAdmin({
    actorId: session.user.id,
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    role: roleFromForm(formData),
  });

  redirect(`${localizedAdminUsersPath(formData)}?status=user-created`);
}

export async function createInvitationAction(formData: FormData) {
  const session = await requireAdminSession();

  await getAuthService().createInvitation({
    actorId: session.user.id,
    email: formValue(formData, "email"),
    role: roleFromForm(formData),
  });

  redirect(`${localizedAdminUsersPath(formData)}?status=invitation-created`);
}
