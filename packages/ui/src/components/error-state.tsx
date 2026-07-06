import { AlertCircleIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import type { StateProps } from "./state-types";

export function ErrorState({
  action,
  className,
  description,
  title,
}: StateProps) {
  return (
    <Card className={cn("border-destructive/40", className)}>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircleIcon
          aria-hidden="true"
          className="text-destructive size-8"
        />
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action ? (
          <Button onClick={action.onClick} type="button" variant="outline">
            {action.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
