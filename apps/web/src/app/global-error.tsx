"use client";

import { ErrorState } from "@nextjs-saas/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-dvh items-center justify-center p-6">
          <ErrorState
            action={{ label: "Try again", onClick: reset }}
            description={error.message}
            title="The application shell failed to render."
          />
        </main>
      </body>
    </html>
  );
}
