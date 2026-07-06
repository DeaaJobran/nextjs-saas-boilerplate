import { cookies } from "next/headers";

const adminSessionCookieName = "nextjs_saas_admin_session";

export async function requireAdminAuth() {
  const expectedToken = process.env.ADMIN_SESSION_TOKEN;

  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SESSION_TOKEN is required for admin mutations.");
    }

    return;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  if (sessionToken !== expectedToken) {
    throw new Error("Admin authentication is required.");
  }
}
