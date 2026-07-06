import { ErrorState } from "@nextjs-saas/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        action={{ href: "/", label: "Return home" }}
        description="The requested page is not available for this locale."
        title="Page not found"
      />
    </main>
  );
}
