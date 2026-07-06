import { MarketingShell } from "../../../components/shells";
import { assertLocale } from "../../../lib/locale";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <MarketingShell locale={assertLocale(locale)}>{children}</MarketingShell>
  );
}
