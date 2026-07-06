import { AuthShell } from "../../../components/shells";
import { assertLocale } from "../../../lib/locale";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <AuthShell locale={assertLocale(locale)}>{children}</AuthShell>;
}
