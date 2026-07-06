import { AdminShell } from "../../../../components/shells";
import { requireAdminSession } from "../../../../lib/admin-auth";
import { assertLocale } from "../../../../lib/locale";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminSession();

  return <AdminShell locale={assertLocale(locale)}>{children}</AdminShell>;
}
