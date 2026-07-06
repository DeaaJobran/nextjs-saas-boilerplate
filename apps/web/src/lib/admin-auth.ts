import { authRoleConfig } from "@nextjs-saas/auth";

import { requireCurrentRole } from "./auth";

export async function requireAdminSession() {
  return requireCurrentRole([...authRoleConfig.privilegedRoles]);
}

export async function requireAdminAuth() {
  const session = await requireAdminSession();

  return session.user.id;
}
