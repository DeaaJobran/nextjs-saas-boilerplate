"use client";

import { ErrorState } from "@nextjs-saas/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        action={{ label: "Try again", onClick: reset }}
        description={error.message}
        title="This route failed to render."
      />
    </main>
  );
}
