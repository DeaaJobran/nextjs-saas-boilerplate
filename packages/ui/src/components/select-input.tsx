import * as React from "react";

import { cn } from "../lib/utils";

export function SelectInput({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "bg-background focus-visible:ring-ring min-h-11 w-full rounded-md border px-3 py-2 text-base shadow-sm transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
