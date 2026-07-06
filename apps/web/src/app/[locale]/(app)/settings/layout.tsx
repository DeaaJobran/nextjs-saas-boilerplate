import { DashboardShell } from "../../../../components/shells";
import { assertLocale } from "../../../../lib/locale";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <DashboardShell locale={assertLocale(locale)} title="Settings">
      {children}
    </DashboardShell>
  );
}
