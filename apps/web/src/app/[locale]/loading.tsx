import { LoadingState } from "@nextjs-saas/ui";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <LoadingState
        description="Preparing the requested application surface."
        title="Loading"
      />
    </main>
  );
}
