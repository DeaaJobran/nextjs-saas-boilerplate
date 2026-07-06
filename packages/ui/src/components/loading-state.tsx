import { LoaderCircleIcon } from "lucide-react";

import { cn } from "../lib/utils";
import type { StateProps } from "./state-types";

export function LoadingState({
  className,
  description,
  title,
}: Omit<StateProps, "action">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "bg-card text-card-foreground flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center",
        className,
      )}
      role="status"
    >
      <LoaderCircleIcon
        aria-hidden="true"
        className="text-primary size-8 animate-spin"
      />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
