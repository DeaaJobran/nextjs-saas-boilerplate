import { SearchIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import type { StateProps } from "./state-types";

export function EmptyState({
  action,
  className,
  description,
  title,
}: StateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground size-8"
        />
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action ? (
          <Button asChild={Boolean(action.href)} variant="outline">
            {action.href ? (
              <a href={action.href}>{action.label}</a>
            ) : (
              <button onClick={action.onClick} type="button">
                {action.label}
              </button>
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
